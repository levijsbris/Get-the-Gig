namespace PortfolioPro.Api.Endpoints;

public static class HealthEndpoints
{
    public static IEndpointRouteBuilder MapHealthEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/health", () => Results.Ok(new HealthResponse("ok")))
            .WithName("Health")
            .AllowAnonymous();

        return app;
    }
}

public sealed record HealthResponse(string Status);
