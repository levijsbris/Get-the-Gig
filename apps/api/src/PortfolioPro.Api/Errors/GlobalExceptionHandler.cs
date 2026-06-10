using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;

namespace PortfolioPro.Api.Errors;

public sealed class GlobalExceptionHandler(ILogger<GlobalExceptionHandler> log) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(
        HttpContext http,
        Exception exception,
        CancellationToken ct)
    {
        var correlationId = http.TraceIdentifier;

        if (exception is ProblemDetailsException pde)
        {
            log.LogInformation(
                "Returning {Status} {Type} for {CorrelationId}: {Detail}",
                pde.StatusCode, pde.Type, correlationId, pde.Detail);

            await WriteProblem(http, new ProblemDetails
            {
                Status = pde.StatusCode,
                Title = pde.Title,
                Detail = pde.Detail,
                Type = pde.Type,
                Extensions = { ["correlationId"] = correlationId },
            }, ct);
            return true;
        }

        log.LogError(exception, "Unhandled exception for {CorrelationId}", correlationId);

        await WriteProblem(http, new ProblemDetails
        {
            Status = StatusCodes.Status500InternalServerError,
            Title = "Internal Server Error",
            Detail = "An unexpected error occurred. Reference the correlation ID when reporting.",
            Type = "https://portfoliopro.com/errors/internal",
            Extensions = { ["correlationId"] = correlationId },
        }, ct);
        return true;
    }

    private static Task WriteProblem(HttpContext http, ProblemDetails problem, CancellationToken ct)
    {
        http.Response.StatusCode = problem.Status ?? StatusCodes.Status500InternalServerError;
        http.Response.ContentType = "application/problem+json";
        return http.Response.WriteAsJsonAsync(problem, cancellationToken: ct);
    }
}
