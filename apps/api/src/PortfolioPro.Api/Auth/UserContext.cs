namespace PortfolioPro.Api.Auth;

public sealed record UserContext(string Uid, string Email, string? Username);
// Endpoint handlers take HttpContext + call ctx.GetUser() (in RequireUserExtensions)
// rather than receiving UserContext as a bound parameter: minimal-API parameter
// binding runs BEFORE endpoint filters, so a BindAsync override would not see the
// HttpContext.Items entry the RequireUser filter writes.
