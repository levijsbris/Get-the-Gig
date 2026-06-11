namespace PortfolioPro.Api.Endpoints.Portfolios.Dto;

public sealed record UpdatePortfolioRequest(string? Title, string? Description, string? Slug);
