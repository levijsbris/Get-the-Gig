namespace PortfolioPro.Api.Auth;

public static class ReservedUsernames
{
    public static readonly IReadOnlySet<string> All = new HashSet<string>(StringComparer.Ordinal)
    {
        "admin",
        "api",
        "assets",
        "help",
        "login",
        "portfolio",
        "portfoliopro",
        "signup",
        "static",
        "support",
        "v",
        "www",
    };

    public static bool IsReserved(string username) => All.Contains(username);
}
