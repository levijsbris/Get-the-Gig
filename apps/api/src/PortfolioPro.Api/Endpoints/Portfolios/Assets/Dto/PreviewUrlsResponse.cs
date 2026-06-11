namespace PortfolioPro.Api.Endpoints.Portfolios.Assets.Dto;

public sealed record PreviewUrlEntry(string AssetId, string Url, DateTimeOffset ExpiresAt);

public sealed record PreviewUrlsResponse(IReadOnlyList<PreviewUrlEntry> Urls);
