using System.Net;
using System.Net.Http.Json;

namespace PortfolioPro.Api.Infrastructure;

/// <summary>
/// Emulator-only object client. Hits fake-gcs's JSON API to inspect / delete
/// objects and its bucket-create endpoint to bootstrap the private bucket on
/// startup. Phase 11+ replaces this with Google.Cloud.Storage.V1's StorageClient
/// against the real GCS endpoint.
/// </summary>
public sealed class EmulatorStorageObjectClient(
    HttpClient http,
    StorageOptions options,
    ILogger<EmulatorStorageObjectClient> log) : IStorageObjectClient
{
    public async Task<StorageObjectMetadata?> HeadAsync(string key, CancellationToken ct)
    {
        var url = ObjectMetadataUrl(key);
        using var response = await http.GetAsync(url, ct);
        if (response.StatusCode == HttpStatusCode.NotFound)
            return null;
        response.EnsureSuccessStatusCode();

        var body = await response.Content.ReadFromJsonAsync<FakeGcsObjectMetadata>(cancellationToken: ct);
        if (body is null) return null;
        return new StorageObjectMetadata(body.Size, body.ContentType ?? "application/octet-stream");
    }

    public async Task DeleteAsync(string key, CancellationToken ct)
    {
        var url = ObjectMetadataUrl(key);
        using var response = await http.DeleteAsync(url, ct);
        if (response.StatusCode == HttpStatusCode.NotFound)
            return;
        response.EnsureSuccessStatusCode();
    }

    public async Task EnsureBucketAsync(CancellationToken ct)
    {
        // fake-gcs lazily creates buckets on first PUT but won't accept reads from
        // a never-created bucket, so be explicit. The JSON-API bucket-create
        // endpoint returns 409 if the bucket already exists; we treat that as
        // success.
        var createUrl = new Uri(
            options.FakeGcsBaseUrl,
            $"storage/v1/b?project={Uri.EscapeDataString("portfoliopro-local")}");
        using var response = await http.PostAsJsonAsync(
            createUrl, new { name = options.PrivateBucket }, ct);
        if (response.StatusCode == HttpStatusCode.Conflict)
            return;
        if (!response.IsSuccessStatusCode)
        {
            var detail = await response.Content.ReadAsStringAsync(ct);
            log.LogWarning(
                "fake-gcs bucket create returned {Status}: {Detail}", response.StatusCode, detail);
        }
    }

    private Uri ObjectMetadataUrl(string key) =>
        new(
            options.FakeGcsBaseUrl,
            $"storage/v1/b/{Uri.EscapeDataString(options.PrivateBucket)}/o/{Uri.EscapeDataString(key)}");

    private sealed record FakeGcsObjectMetadata(long Size, string? ContentType);
}
