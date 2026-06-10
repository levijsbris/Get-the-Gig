namespace PortfolioPro.Api.Auth;

public sealed record UserContext(string Uid, string Email, string? Username)
{
    // Minimal-API parameter binding: handlers can declare `UserContext user` and the
    // RequireUser filter's HttpContext.Items entry is surfaced here.
    public static ValueTask<UserContext?> BindAsync(HttpContext ctx) =>
        ValueTask.FromResult(ctx.Items.TryGetValue(typeof(UserContext), out var v) ? v as UserContext : null);
}
