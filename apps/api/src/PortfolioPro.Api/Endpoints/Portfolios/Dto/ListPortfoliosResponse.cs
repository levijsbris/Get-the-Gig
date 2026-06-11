namespace PortfolioPro.Api.Endpoints.Portfolios.Dto;

public sealed record ListPortfoliosResponse(IReadOnlyList<PortfolioSummary> Portfolios);
