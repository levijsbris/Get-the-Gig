namespace PortfolioPro.Api.Endpoints.Portfolios.Assets.Dto;

public sealed record UploadUrlResponse(
    string AssetId,
    string UploadUrl,
    string StoragePath,
    long PortfolioBytesAfterUpload,
    long PortfolioBytesQuota,
    bool WarnPortfolioQuota);
