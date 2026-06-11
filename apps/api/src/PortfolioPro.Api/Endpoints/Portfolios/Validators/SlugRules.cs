using System.Text.RegularExpressions;

namespace PortfolioPro.Api.Endpoints.Portfolios.Validators;

public static partial class SlugRules
{
    public const int MinLength = 1;
    public const int MaxLength = 40;

    [GeneratedRegex("^[a-z0-9-]{1,40}$", RegexOptions.CultureInvariant)]
    public static partial Regex Pattern();

    public static bool IsValid(string? candidate) =>
        !string.IsNullOrEmpty(candidate) && Pattern().IsMatch(candidate);

    public const string ErrorMessage =
        "Slug must be 1-40 lowercase letters, digits, or hyphens.";
}
