namespace PortfolioPro.Api.Errors;

public sealed class PortfolioNotSoftDeletedException : ProblemDetailsException
{
    public PortfolioNotSoftDeletedException()
        : base(
            statusCode: StatusCodes.Status409Conflict,
            title: "Portfolio is not soft-deleted",
            detail: "Restore only applies to portfolios that have been soft-deleted.",
            type: "https://portfoliopro.com/errors/not-soft-deleted")
    {
    }
}
