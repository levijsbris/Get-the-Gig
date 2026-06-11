namespace PortfolioPro.Api.Endpoints.Portfolios.Assets.Dto;

public sealed record ListAssetsResponse(
    IReadOnlyList<AssetSummary> Assets,
    long PortfolioBytesUsed,
    long PortfolioBytesQuota,
    bool WarnPortfolioQuota);
