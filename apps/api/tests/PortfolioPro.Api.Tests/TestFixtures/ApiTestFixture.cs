using System.Net.Http.Headers;
using Google.Api.Gax;
using Google.Cloud.Firestore;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using PortfolioPro.Api.Auth;

namespace PortfolioPro.Api.Tests.TestFixtures;

public sealed class ApiTestFixture : WebApplicationFactory<Program>
{
    public const string ProjectId = "portfoliopro-test";
    public const string FirestoreEmulatorHost = "localhost:8080";

    public TestJwtIssuer Jwt { get; } = new();

    public ApiTestFixture()
    {
        Environment.SetEnvironmentVariable("ASPNETCORE_ENVIRONMENT", "Testing");
        Environment.SetEnvironmentVariable("FIRESTORE_EMULATOR_HOST", FirestoreEmulatorHost);
        Environment.SetEnvironmentVariable("FIRESTORE_PROJECT_ID", ProjectId);
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

    protected override void Dispose(bool disposing)
    {
        if (disposing) Jwt.Dispose();
        base.Dispose(disposing);
    }
}
