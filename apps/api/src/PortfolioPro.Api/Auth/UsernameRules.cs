using System.Text.RegularExpressions;

namespace PortfolioPro.Api.Auth;

public static partial class UsernameRules
{
    public const int MinLength = 3;
    public const int MaxLength = 30;

    [GeneratedRegex("^[a-z0-9-]{3,30}$", RegexOptions.CultureInvariant)]
    private static partial Regex UsernamePattern();

    public static UsernameValidation Validate(string? candidate)
    {
        if (string.IsNullOrWhiteSpace(candidate))
            return UsernameValidation.Invalid("Username is required.");

        if (!UsernamePattern().IsMatch(candidate))
            return UsernameValidation.Invalid(
                $"Username must be {MinLength}-{MaxLength} characters: lowercase letters, digits, or hyphens.");

        if (ReservedUsernames.IsReserved(candidate))
            return UsernameValidation.Invalid("That username is reserved.");

        return UsernameValidation.Ok();
    }
}

public readonly record struct UsernameValidation(bool IsValid, string? Error)
{
    public static UsernameValidation Ok() => new(true, null);
    public static UsernameValidation Invalid(string error) => new(false, error);
}
