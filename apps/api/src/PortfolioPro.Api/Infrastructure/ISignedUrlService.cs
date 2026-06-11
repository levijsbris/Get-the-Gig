namespace PortfolioPro.Api.Infrastructure;

public interface ISignedUrlService
{
    /// <summary>
    /// Mints a direct-upload URL for an authenticated user to write to the private
    /// bucket. The implementation MUST refuse any key that does not start with
    /// users/{uid}/ — the storage-paths-begin-with-users/{uid} rule from the
    /// add-endpoint skill is enforced here so endpoints can't accidentally widen
    /// the upload scope. The HTTP method to use is part of the returned record
    /// because the emulator (fake-gcs JSON-API simple upload) requires POST while
    /// production GCS V4 signed URLs use PUT.
    /// </summary>
    SignedUploadUrl MintUploadUrl(string uid, string key, string contentType);

    /// <summary>
    /// Mints a time-limited download URL for the given storage key. Like
    /// MintUploadUrl, refuses any key that doesn't start with users/{uid}/.
    /// TTL is bounded by CLAUDE.md's "≤ 15 minutes" rule; callers enforce
    /// the cap by passing an appropriate TimeSpan.
    /// </summary>
    SignedDownloadUrl MintDownloadUrl(string uid, string key, TimeSpan ttl);
}

public sealed record SignedUploadUrl(Uri Url, string Method);

public sealed record SignedDownloadUrl(Uri Url, DateTimeOffset ExpiresAt);

public sealed class InvalidStorageKeyException : InvalidOperationException
{
    public InvalidStorageKeyException(string message) : base(message) { }
}
