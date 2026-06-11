namespace PortfolioPro.Api.Errors;

public sealed class PortfolioNotFoundException : ProblemDetailsException
{
    public PortfolioNotFoundException()
        : base(
            statusCode: StatusCodes.Status404NotFound,
            title: "Portfolio not found",
            detail: "No portfolio exists with that ID for the authenticated user.",
            type: "https://portfoliopro.com/errors/portfolio-not-found")
    {
    }
}
