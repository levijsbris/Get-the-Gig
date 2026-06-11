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

        group.MapPatch("/", UpdateDraft)
            .WithName("UpdateDraft")
            .Produces<UpdateDraftResponse>(StatusCodes.Status200OK)
            .ProducesValidationProblem()
            .ProducesProblem(StatusCodes.Status400BadRequest)
            .ProducesProblem(StatusCodes.Status404NotFound);

        return app;
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
