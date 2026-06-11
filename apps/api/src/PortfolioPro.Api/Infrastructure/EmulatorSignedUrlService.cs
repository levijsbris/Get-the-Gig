namespace PortfolioPro.Api.Infrastructure;

/// <summary>
/// Emulator-only signed-URL minting. Returns a fake-gcs JSON-API simple-upload
/// URL (POST to /upload/storage/v1/b/{bucket}/o?uploadType=media&name=...).
/// fake-gcs doesn't support the XML-API PUT /{bucket}/{key} pattern that real
/// GCS V4 signed URLs use; Phase 11 production deploy needs to swap this for a
/// real Google.Cloud.Storage.V1 UrlSigner against the prod private bucket and
/// switch the method to PUT — leave ISignedUrlService as the seam and read
/// SignedUploadUrl.Method on the client.
/// </summary>
public sealed class EmulatorSignedUrlService(StorageOptions options) : ISignedUrlService
{
    public SignedUploadUrl MintUploadUrl(string uid, string key, string contentType)
    {
        if (!key.StartsWith($"users/{uid}/", StringComparison.Ordinal))
            throw new InvalidStorageKeyException(
                $"Storage key must start with 'users/{uid}/'. Refusing to sign '{key}'.");

        var url = new Uri(
            options.FakeGcsBaseUrl,
            $"upload/storage/v1/b/{Uri.EscapeDataString(options.PrivateBucket)}/o" +
                $"?uploadType=media&name={Uri.EscapeDataString(key)}");
        return new SignedUploadUrl(url, "POST");
    }
}
