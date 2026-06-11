using Google.Cloud.Firestore;

namespace PortfolioPro.Api.Services;

public sealed record AssetRecord(
    string Id,
    string Uid,
    string OwnerPortfolioId,
    string Filename,
    string ContentType,
    long ByteSize,
    string StoragePath,
    int? Width,
    int? Height,
    Timestamp CreatedAt,
    Timestamp? SoftDeletedAt);
