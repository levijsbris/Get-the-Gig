namespace PortfolioPro.Api.Errors;

public sealed class PortfolioGracePeriodExpiredException : ProblemDetailsException
{
    public PortfolioGracePeriodExpiredException()
        : base(
            statusCode: StatusCodes.Status409Conflict,
            title: "Restore window has elapsed",
            detail: "More than 7 days have passed since soft-delete; the portfolio is queued for hard-delete and can no longer be restored.",
            type: "https://portfoliopro.com/errors/grace-period-expired")
    {
    }
}
