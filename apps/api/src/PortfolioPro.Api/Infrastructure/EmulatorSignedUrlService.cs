namespace PortfolioPro.Api.Infrastructure;

/// <summary>
/// Emulator-only signed-URL minting. Upload URLs hit fake-gcs's JSON-API
/// simple-upload endpoint (POST to /upload/storage/v1/b/{bucket}/o?uploadType=media&name=...);
/// download URLs hit the object-metadata endpoint with ?alt=media. fake-gcs
/// accepts both anonymously, so the "signed" part is synthetic — the URL just
/// carries an ExpiresAt for client cache-invalidation logic, not an actual
/// signature. Phase 11 production deploy needs to swap this for a real
/// Google.Cloud.Storage.V1 UrlSigner (V4 PUT/GET) against the prod private
/// bucket — leave ISignedUrlService as the seam.
/// </summary>
public sealed class EmulatorSignedUrlService(StorageOptions options, IClock clock) : ISignedUrlService
{
    public SignedUploadUrl MintUploadUrl(string uid, string key, string contentType)
    {
        EnsureUserScopedKey(uid, key);
        var url = new Uri(
            options.FakeGcsBaseUrl,
            $"upload/storage/v1/b/{Uri.EscapeDataString(options.PrivateBucket)}/o" +
                $"?uploadType=media&name={Uri.EscapeDataString(key)}");
        return new SignedUploadUrl(url, "POST");
    }

    public SignedDownloadUrl MintDownloadUrl(string uid, string key, TimeSpan ttl)
    {
        EnsureUserScopedKey(uid, key);
        var url = new Uri(
            options.FakeGcsBaseUrl,
            $"storage/v1/b/{Uri.EscapeDataString(options.PrivateBucket)}/o/{Uri.EscapeDataString(key)}?alt=media");
        return new SignedDownloadUrl(url, clock.UtcNow.Add(ttl));
    }

    private static void EnsureUserScopedKey(string uid, string key)
    {
        if (!key.StartsWith($"users/{uid}/", StringComparison.Ordinal))
            throw new InvalidStorageKeyException(
                $"Storage key must start with 'users/{uid}/'. Refusing to sign '{key}'.");
    }
}
