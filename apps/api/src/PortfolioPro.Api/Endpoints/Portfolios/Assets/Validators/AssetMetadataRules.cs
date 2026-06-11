using PortfolioPro.Api.Services;

namespace PortfolioPro.Api.Endpoints.Portfolios.Assets.Validators;

public static class AssetMetadataRules
{
    public const int MaxFilenameLength = 200;

    public static bool FilenameIsSafe(string? candidate)
    {
        if (string.IsNullOrWhiteSpace(candidate)) return false;
        if (candidate.Length > MaxFilenameLength) return false;
        // No path separators, no leading/trailing whitespace, no null bytes.
        if (candidate.IndexOfAny(new[] { '/', '\\', '\0' }) >= 0) return false;
        if (candidate != candidate.Trim()) return false;
        return true;
    }

    public static bool ContentTypeAllowed(string? candidate) =>
        candidate is not null && AssetLimits.AllowedContentTypes.Contains(candidate);

    public static bool ByteSizeWithinPerFileCap(long size, string contentType) =>
        size > 0 && size <= AssetLimits.PerFileCap(contentType);
}
