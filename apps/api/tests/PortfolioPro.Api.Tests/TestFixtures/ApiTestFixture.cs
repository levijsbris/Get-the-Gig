using System.Net.Http.Headers;
using Google.Api.Gax;
using Google.Cloud.Firestore;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using PortfolioPro.Api.Auth;
using PortfolioPro.Api.Infrastructure;

namespace PortfolioPro.Api.Tests.TestFixtures;

public sealed class ApiTestFixture : WebApplicationFactory<Program>
{
    public const string ProjectId = "portfoliopro-test";
    public const string DefaultFirestoreEmulatorHost = "localhost:8080";
    public const string DefaultFakeGcsHost = "http://localhost:9199";
    public const string TestBucket = "portfoliopro-test-private";

    public string FirestoreEmulatorHost { get; }
    public string FakeGcsBaseUrl { get; }

    public TestJwtIssuer Jwt { get; } = new();
    public FakeClock Clock { get; } = new();

    public ApiTestFixture()
    {
        // Honour an externally provided FIRESTORE_EMULATOR_HOST (e.g. firebase
        // emulators:exec in CI may pick a different port); otherwise fall back to
        // the docker-compose default.
        FirestoreEmulatorHost = Environment.GetEnvironmentVariable("FIRESTORE_EMULATOR_HOST")
            ?? DefaultFirestoreEmulatorHost;
        FakeGcsBaseUrl = Environment.GetEnvironmentVariable("STORAGE_EMULATOR_HOST") ?? DefaultFakeGcsHost;
        if (!FakeGcsBaseUrl.StartsWith("http", StringComparison.OrdinalIgnoreCase))
            FakeGcsBaseUrl = $"http://{FakeGcsBaseUrl}";

        Environment.SetEnvironmentVariable("ASPNETCORE_ENVIRONMENT", "Testing");
        Environment.SetEnvironmentVariable("FIRESTORE_EMULATOR_HOST", FirestoreEmulatorHost);
        Environment.SetEnvironmentVariable("FIRESTORE_PROJECT_ID", ProjectId);
        Environment.SetEnvironmentVariable("STORAGE_EMULATOR_HOST", FakeGcsBaseUrl);
        Environment.SetEnvironmentVariable("STORAGE_PRIVATE_BUCKET", TestBucket);
        // FIREBASE_AUTH_EMULATOR_HOST is intentionally unset — the local-key validator
        // replaces FirebaseIdTokenValidator, and Program.cs skips Firebase Admin
        // bootstrapping in the Testing environment.

        // Construct Firestore AFTER setting the env var; FirestoreDbBuilder reads
        // FIRESTORE_EMULATOR_HOST during construction when EmulatorDetection is on.
        Firestore = new FirestoreDbBuilder
        {
            ProjectId = ProjectId,
            EmulatorDetection = EmulatorDetection.EmulatorOnly,
        }.Build();
    }

    public FirestoreDb Firestore { get; }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.ConfigureTestServices(services =>
        {
            services.RemoveAll<IIdTokenValidator>();
            services.AddSingleton(Jwt);
            services.AddSingleton<IIdTokenValidator, LocalKeyIdTokenValidator>();

            services.RemoveAll<PortfolioPro.Api.Infrastructure.IClock>();
            services.AddSingleton<PortfolioPro.Api.Infrastructure.IClock>(Clock);
        });
    }

    public HttpClient CreateAnonymousClient() => CreateClient();

    public HttpClient CreateClientFor(string uid, string email)
    {
        var client = CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", Jwt.Issue(uid, email));
        return client;
    }

    public HttpClient CreateClientWithToken(string token)
    {
        var client = CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    public async Task ResetFirestoreAsync()
    {
        using var http = new HttpClient { BaseAddress = new Uri($"http://{FirestoreEmulatorHost}") };
        var response = await http.DeleteAsync($"/emulator/v1/projects/{ProjectId}/databases/(default)/documents");
        response.EnsureSuccessStatusCode();
    }

    /// <summary>
    /// Ensure the test private bucket exists in fake-gcs. Safe to call repeatedly;
    /// 409 from fake-gcs means already-exists.
    /// </summary>
    public async Task EnsureBucketAsync()
    {
        using var http = new HttpClient();
        var createUrl = $"{FakeGcsBaseUrl.TrimEnd('/')}/storage/v1/b?project=portfoliopro-test";
        var response = await http.PostAsync(
            createUrl,
            new StringContent(
                System.Text.Json.JsonSerializer.Serialize(new { name = TestBucket }),
                System.Text.Encoding.UTF8,
                "application/json"));
        if (response.StatusCode != System.Net.HttpStatusCode.Conflict)
            response.EnsureSuccessStatusCode();
    }

    /// <summary>
    /// Performs the client-side direct upload step against the supplied URL using
    /// the supplied HTTP method (POST for the emulator JSON-API path, PUT for the
    /// real V4 signed URL Phase 11+ will switch to).
    /// </summary>
    public async Task UploadToSignedUrlAsync(string uploadUrl, string method, byte[] bytes, string contentType)
    {
        using var http = new HttpClient();
        using var content = new ByteArrayContent(bytes);
        content.Headers.ContentType = MediaTypeHeaderValue.Parse(contentType);
        using var request = new HttpRequestMessage(new HttpMethod(method), uploadUrl) { Content = content };
        using var response = await http.SendAsync(request);
        response.EnsureSuccessStatusCode();
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing) Jwt.Dispose();
        base.Dispose(disposing);
    }
}
