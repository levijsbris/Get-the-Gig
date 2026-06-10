using Google.Cloud.Firestore;

namespace PortfolioPro.Api.Auth;

public sealed class RequireUserFilter(
    IIdTokenValidator validator,
    FirestoreDb firestore,
    ILogger<RequireUserFilter> log) : IEndpointFilter
{
    private const string BearerPrefix = "Bearer ";

    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext ctx, EndpointFilterDelegate next)
    {
        var http = ctx.HttpContext;
        var ct = http.RequestAborted;

        var authHeader = http.Request.Headers.Authorization.ToString();
        if (string.IsNullOrEmpty(authHeader) || !authHeader.StartsWith(BearerPrefix, StringComparison.Ordinal))
            return Unauthorized("Missing or malformed Authorization header.");

        var token = authHeader[BearerPrefix.Length..].Trim();
        if (token.Length == 0)
            return Unauthorized("Empty bearer token.");

        IdTokenInfo info;
        try
        {
            info = await validator.ValidateAsync(token, ct);
        }
        catch (InvalidIdTokenException ex)
        {
            log.LogInformation("Rejected request: {Reason}", ex.Message);
            return Unauthorized("ID token is invalid or expired.");
        }

        string? username = null;
        var userSnap = await firestore.Collection("users").Document(info.Uid).GetSnapshotAsync(ct);
        if (userSnap.Exists && userSnap.TryGetValue("username", out string? storedUsername))
            username = storedUsername;

        http.Items[typeof(UserContext)] = new UserContext(info.Uid, info.Email, username);
        return await next(ctx);
    }

    private static IResult Unauthorized(string detail) =>
        Results.Problem(
            title: "Unauthorized",
            detail: detail,
            statusCode: StatusCodes.Status401Unauthorized,
            type: "https://portfoliopro.com/errors/unauthorized");
}
