namespace PortfolioPro.Api.Errors;

public sealed class AssetQuotaExceededException : ProblemDetailsException
{
    public AssetQuotaExceededException(long bytesAfter, long hardCap)
        : base(
            statusCode: StatusCodes.Status409Conflict,
            title: "Portfolio storage quota would be exceeded",
            detail: $"Upload would bring this portfolio to {bytesAfter} bytes; the hard cap is {hardCap} bytes ({hardCap / 1024 / 1024} MB).",
            type: "https://portfoliopro.com/errors/quota-exceeded")
    {
    }
}
