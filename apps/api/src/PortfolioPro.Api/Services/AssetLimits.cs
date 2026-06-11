namespace PortfolioPro.Api.Services;

public static class AssetLimits
{
    public const long MaxImageBytes = 10 * 1024 * 1024;     //  10 MB
    public const long MaxPdfBytes = 25 * 1024 * 1024;       //  25 MB
    public const long PortfolioWarnBytes = 500 * 1024 * 1024; // 500 MB
    public const long PortfolioHardCapBytes = 600 * 1024 * 1024; // 600 MB

    public static readonly IReadOnlySet<string> AllowedContentTypes = new HashSet<string>(StringComparer.Ordinal)
    {
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
        "application/pdf",
    };

    public static bool IsImage(string contentType) => contentType.StartsWith("image/", StringComparison.Ordinal);

    public static long PerFileCap(string contentType) =>
        contentType == "application/pdf" ? MaxPdfBytes : MaxImageBytes;
}
