namespace PortfolioPro.Api.Endpoints.Portfolios.Dto;

public sealed record CreatePortfolioRequest(string Title, string Slug, string? Description);
