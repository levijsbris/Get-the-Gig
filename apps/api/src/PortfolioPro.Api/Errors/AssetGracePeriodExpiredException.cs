namespace PortfolioPro.Api.Errors;

public sealed class AssetGracePeriodExpiredException : ProblemDetailsException
{
    public AssetGracePeriodExpiredException()
        : base(
            statusCode: StatusCodes.Status409Conflict,
            title: "Restore window has elapsed",
            detail: "More than 7 days have passed since soft-delete; the asset is queued for hard-delete and can no longer be restored.",
            type: "https://portfoliopro.com/errors/grace-period-expired")
    {
    }
}
