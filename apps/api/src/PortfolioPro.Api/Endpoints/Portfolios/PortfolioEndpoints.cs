using FluentValidation;
using PortfolioPro.Api.Auth;
using PortfolioPro.Api.Endpoints.Portfolios.Dto;
using PortfolioPro.Api.Services;

namespace PortfolioPro.Api.Endpoints.Portfolios;

public static class PortfolioEndpoints
{
    public static IEndpointRouteBuilder MapPortfolioEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/portfolios")
            .RequireUser()
            .WithTags("Portfolios");

        group.MapGet("/", List)
            .WithName("ListPortfolios")
            .Produces<ListPortfoliosResponse>(StatusCodes.Status200OK);

        group.MapPost("/", Create)
            .WithName("CreatePortfolio")
            .Produces<PortfolioSummary>(StatusCodes.Status201Created)
            .ProducesValidationProblem()
            .ProducesProblem(StatusCodes.Status409Conflict);

        group.MapGet("/{id}", Get)
            .WithName("GetPortfolio")
            .Produces<PortfolioSummary>(StatusCodes.Status200OK)
            .ProducesProblem(StatusCodes.Status404NotFound);

        group.MapPatch("/{id}", Update)
            .WithName("UpdatePortfolio")
            .Produces<PortfolioSummary>(StatusCodes.Status200OK)
            .ProducesValidationProblem()
            .ProducesProblem(StatusCodes.Status404NotFound)
            .ProducesProblem(StatusCodes.Status409Conflict);

        group.MapDelete("/{id}", SoftDelete)
            .WithName("SoftDeletePortfolio")
            .Produces(StatusCodes.Status204NoContent)
            .ProducesProblem(StatusCodes.Status404NotFound);

        group.MapPost("/{id}/restore", Restore)
            .WithName("RestorePortfolio")
            .Produces<PortfolioSummary>(StatusCodes.Status200OK)
            .ProducesProblem(StatusCodes.Status404NotFound)
            .ProducesProblem(StatusCodes.Status409Conflict);

        return app;
    }

    private static async Task<IResult> List(
        HttpContext http,
        PortfolioService portfolios,
        bool? includeDeleted,
        CancellationToken ct)
    {
        var user = http.GetUser();
        var records = await portfolios.ListAsync(user.Uid, includeDeleted ?? false, ct);
        return Results.Ok(new ListPortfoliosResponse(records.Select(PortfolioSummary.From).ToList()));
    }

    private static async Task<IResult> Create(
        CreatePortfolioRequest request,
        HttpContext http,
        PortfolioService portfolios,
        IValidator<CreatePortfolioRequest> validator,
        CancellationToken ct)
    {
        var user = http.GetUser();
        var validation = await validator.ValidateAsync(request, ct);
        if (!validation.IsValid)
            return Results.ValidationProblem(validation.ToDictionary());

        var record = await portfolios.CreateAsync(
            user.Uid, request.Title, request.Slug, request.Description ?? string.Empty, ct);
        return Results.Created($"/api/portfolios/{record.Id}", PortfolioSummary.From(record));
    }

    private static async Task<IResult> Get(
        string id,
        HttpContext http,
        PortfolioService portfolios,
        CancellationToken ct)
    {
        var user = http.GetUser();
        var record = await portfolios.GetAsync(user.Uid, id, ct);
        return record is null
            ? Results.Problem(
                title: "Portfolio not found",
                detail: "No portfolio exists with that ID for the authenticated user.",
                statusCode: StatusCodes.Status404NotFound,
                type: "https://portfoliopro.com/errors/portfolio-not-found")
            : Results.Ok(PortfolioSummary.From(record));
    }

    private static async Task<IResult> Update(
        string id,
        UpdatePortfolioRequest request,
        HttpContext http,
        PortfolioService portfolios,
        IValidator<UpdatePortfolioRequest> validator,
        CancellationToken ct)
    {
        var user = http.GetUser();
        var validation = await validator.ValidateAsync(request, ct);
        if (!validation.IsValid)
            return Results.ValidationProblem(validation.ToDictionary());

        var record = await portfolios.UpdateAsync(
            user.Uid, id, request.Title, request.Description, request.Slug, ct);
        return Results.Ok(PortfolioSummary.From(record));
    }

    private static async Task<IResult> SoftDelete(
        string id,
        HttpContext http,
        PortfolioService portfolios,
        CancellationToken ct)
    {
        var user = http.GetUser();
        await portfolios.SoftDeleteAsync(user.Uid, id, ct);
        return Results.NoContent();
    }

    private static async Task<IResult> Restore(
        string id,
        HttpContext http,
        PortfolioService portfolios,
        CancellationToken ct)
    {
        var user = http.GetUser();
        var record = await portfolios.RestoreAsync(user.Uid, id, ct);
        return Results.Ok(PortfolioSummary.From(record));
    }
}
