namespace PortfolioPro.Api.Auth;

public static class RequireUserExtensions
{
    public static RouteGroupBuilder RequireUser(this RouteGroupBuilder group)
    {
        group.AddEndpointFilter<RequireUserFilter>();
        return group;
    }

    public static RouteHandlerBuilder RequireUser(this RouteHandlerBuilder route)
    {
        route.AddEndpointFilter<RequireUserFilter>();
        return route;
    }

    public static UserContext GetUser(this HttpContext ctx) =>
        ctx.Items.TryGetValue(typeof(UserContext), out var v) && v is UserContext user
            ? user
            : throw new InvalidOperationException(
                "UserContext is not on HttpContext.Items. " +
                "Did the endpoint forget to call .RequireUser()?");
}
