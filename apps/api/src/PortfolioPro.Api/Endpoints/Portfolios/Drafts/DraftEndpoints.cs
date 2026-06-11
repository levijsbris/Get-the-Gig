using FluentValidation;
using PortfolioPro.Api.Auth;
using PortfolioPro.Api.Endpoints.Portfolios.Drafts.Dto;
using PortfolioPro.Api.Services;

namespace PortfolioPro.Api.Endpoints.Portfolios.Drafts;

public static class DraftEndpoints
{
    public static IEndpointRouteBuilder MapDraftEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/portfolios/{portfolioId}/draft")
            .RequireUser()
            .WithTags("Drafts");

        group.MapGet("/", GetDraft)
            .WithName("GetDraft")
            .Produces<GetDraftResponse>(StatusCodes.Status200OK)
            .ProducesProblem(StatusCodes.Status404NotFound);

        group.MapPatch("/", UpdateDraft)
            .WithName("UpdateDraft")
            .Produces<UpdateDraftResponse>(StatusCodes.Status200OK)
            .ProducesValidationProblem()
            .ProducesProblem(StatusCodes.Status400BadRequest)
            .ProducesProblem(StatusCodes.Status404NotFound);

        return app;
    }

    private static async Task<IResult> GetDraft(
        string portfolioId,
        HttpContext http,
        PortfolioService portfolios,
        CancellationToken ct)
    {
        var user = http.GetUser();
        var record = await portfolios.GetDraftAsync(user.Uid, portfolioId, ct);
        return record is null
            ? Results.Problem(
                title: "Portfolio not found",
                detail: "No portfolio exists with that ID for the authenticated user.",
                statusCode: StatusCodes.Status404NotFound,
                type: "https://portfoliopro.com/errors/portfolio-not-found")
            : Results.Ok(new GetDraftResponse(record.Draft, record.DraftUpdatedAt, record.DraftSchemaVersion));
    }

    private static async Task<IResult> UpdateDraft(
        string portfolioId,
        UpdateDraftRequest request,
        HttpContext http,
        PortfolioService portfolios,
        IValidator<UpdateDraftRequest> validator,
        CancellationToken ct)
    {
        var user = http.GetUser();
        var validation = await validator.ValidateAsync(request, ct);
        if (!validation.IsValid)
            return Results.ValidationProblem(validation.ToDictionary());

        var updatedAt = await portfolios.UpdateDraftAsync(
            user.Uid, portfolioId, request.Draft, request.DraftSchemaVersion, ct);
        return Results.Ok(new UpdateDraftResponse(updatedAt));
    }
}
