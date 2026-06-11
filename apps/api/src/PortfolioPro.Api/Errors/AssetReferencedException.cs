namespace PortfolioPro.Api.Errors;

public sealed class AssetReferencedException : ProblemDetailsException
{
    public AssetReferencedException(IReadOnlyList<string> references)
        : base(
            statusCode: StatusCodes.Status409Conflict,
            title: "Asset is in use",
            detail: $"This asset is referenced by {references.Count} component(s) in the current draft. Remove the references before deleting.",
            type: "https://portfoliopro.com/errors/asset-referenced")
    {
        References = references;
    }

    public IReadOnlyList<string> References { get; }
}
