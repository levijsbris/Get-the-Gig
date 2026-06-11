namespace PortfolioPro.Api.Errors;

public sealed class AssetNotFoundException : ProblemDetailsException
{
    public AssetNotFoundException()
        : base(
            statusCode: StatusCodes.Status404NotFound,
            title: "Asset not found",
            detail: "No asset exists with that ID for the authenticated user.",
            type: "https://portfoliopro.com/errors/asset-not-found")
    {
    }
}
