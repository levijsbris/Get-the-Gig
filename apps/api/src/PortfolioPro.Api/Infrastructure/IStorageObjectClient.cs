namespace PortfolioPro.Api.Infrastructure;

public interface IStorageObjectClient
{
    Task<StorageObjectMetadata?> HeadAsync(string key, CancellationToken ct);
    Task DeleteAsync(string key, CancellationToken ct);
    Task EnsureBucketAsync(CancellationToken ct);
}

public sealed record StorageObjectMetadata(long Size, string ContentType);
