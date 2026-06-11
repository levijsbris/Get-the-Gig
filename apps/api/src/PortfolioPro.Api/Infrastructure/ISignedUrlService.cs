namespace PortfolioPro.Api.Infrastructure;

public interface ISignedUrlService
{
    /// <summary>
    /// Mints a PUT-able URL for an authenticated user to upload directly to the
    /// private bucket. The implementation MUST refuse any key that does not start
    /// with users/{uid}/ — the storage-paths-begin-with-users/{uid} rule from the
    /// add-endpoint skill is enforced here so endpoints can't accidentally widen
    /// the upload scope.
    /// </summary>
    Uri MintUploadUrl(string uid, string key, string contentType);
}

public sealed class InvalidStorageKeyException : InvalidOperationException
{
    public InvalidStorageKeyException(string message) : base(message) { }
}
