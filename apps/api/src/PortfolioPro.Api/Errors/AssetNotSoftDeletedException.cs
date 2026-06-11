namespace PortfolioPro.Api.Errors;

public sealed class AssetNotSoftDeletedException : ProblemDetailsException
{
    public AssetNotSoftDeletedException()
        : base(
            statusCode: StatusCodes.Status409Conflict,
            title: "Asset is not soft-deleted",
            detail: "Restore only applies to assets that have been soft-deleted.",
            type: "https://portfoliopro.com/errors/not-soft-deleted")
    {
    }
}
