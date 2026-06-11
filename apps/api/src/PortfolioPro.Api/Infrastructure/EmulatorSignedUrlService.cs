namespace PortfolioPro.Api.Infrastructure;

/// <summary>
/// Emulator-only signed-URL minting. Returns a fake-gcs XML-API PUT URL
/// (http://{fake-gcs}/{bucket}/{key}) which accepts anonymous PUTs and stores the
/// object under the given key. Phase 11 production deploy needs to swap this for a
/// real Google.Cloud.Storage.V1 UrlSigner against the prod private bucket — leave
/// ISignedUrlService as the seam.
/// </summary>
public sealed class EmulatorSignedUrlService(StorageOptions options) : ISignedUrlService
{
    public Uri MintUploadUrl(string uid, string key, string contentType)
    {
        if (!key.StartsWith($"users/{uid}/", StringComparison.Ordinal))
            throw new InvalidStorageKeyException(
                $"Storage key must start with 'users/{uid}/'. Refusing to sign '{key}'.");

        // Encode the key segments so spaces/Unicode in filenames don't break the URL.
        var encodedKey = string.Join('/', key.Split('/').Select(Uri.EscapeDataString));
        return new Uri(options.FakeGcsBaseUrl, $"{options.PrivateBucket}/{encodedKey}");
    }
}
