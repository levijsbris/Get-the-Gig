using FluentValidation;
using PortfolioPro.Api.Auth;
using PortfolioPro.Api.Endpoints.Portfolios.Assets.Dto;
using PortfolioPro.Api.Services;

namespace PortfolioPro.Api.Endpoints.Portfolios.Assets;

public static class AssetEndpoints
{
    public static IEndpointRouteBuilder MapAssetEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/portfolios/{portfolioId}/assets")
            .RequireUser()
            .WithTags("Assets");

        group.MapPost("/upload-url", RequestUploadUrl)
            .WithName("RequestAssetUploadUrl")
            .Produces<UploadUrlResponse>(StatusCodes.Status201Created)
            .ProducesValidationProblem()
            .ProducesProblem(StatusCodes.Status404NotFound)
            .ProducesProblem(StatusCodes.Status409Conflict);

        group.MapPost("/{assetId}/confirm", Confirm)
            .WithName("ConfirmAsset")
            .Produces<AssetSummary>(StatusCodes.Status201Created)
            .ProducesValidationProblem()
            .ProducesProblem(StatusCodes.Status400BadRequest)
            .ProducesProblem(StatusCodes.Status404NotFound)
            .ProducesProblem(StatusCodes.Status409Conflict);

        group.MapGet("/", List)
            .WithName("ListAssets")
            .Produces<ListAssetsResponse>(StatusCodes.Status200OK)
            .ProducesProblem(StatusCodes.Status404NotFound);

        group.MapDelete("/{assetId}", SoftDelete)
            .WithName("SoftDeleteAsset")
            .Produces(StatusCodes.Status204NoContent)
            .ProducesProblem(StatusCodes.Status404NotFound)
            .ProducesProblem(StatusCodes.Status409Conflict);

        group.MapPost("/{assetId}/restore", Restore)
            .WithName("RestoreAsset")
            .Produces<AssetSummary>(StatusCodes.Status200OK)
            .ProducesProblem(StatusCodes.Status404NotFound)
            .ProducesProblem(StatusCodes.Status409Conflict);

        group.MapPost("/preview-urls", PreviewUrls)
            .WithName("AssetPreviewUrls")
            .Produces<PreviewUrlsResponse>(StatusCodes.Status200OK)
            .ProducesValidationProblem()
            .ProducesProblem(StatusCodes.Status400BadRequest);

        return app;
    }

    private static async Task<IResult> RequestUploadUrl(
        string portfolioId,
        RequestUploadUrlRequest request,
        HttpContext http,
        AssetService assets,
        IValidator<RequestUploadUrlRequest> validator,
        CancellationToken ct)
    {
        var user = http.GetUser();
        var validation = await validator.ValidateAsync(request, ct);
        if (!validation.IsValid)
            return Results.ValidationProblem(validation.ToDictionary());

        var result = await assets.RequestUploadAsync(
            user.Uid, portfolioId, request.Filename, request.ContentType, request.ByteSize, ct);

        return Results.Created($"/api/portfolios/{portfolioId}/assets/{result.AssetId}",
            new UploadUrlResponse(
                AssetId: result.AssetId,
                UploadUrl: result.UploadUrl.ToString(),
                UploadMethod: result.UploadMethod,
                StoragePath: result.StoragePath,
                PortfolioBytesAfterUpload: result.PortfolioBytesAfterUpload,
                PortfolioBytesQuota: AssetLimits.PortfolioHardCapBytes,
                WarnPortfolioQuota: result.WarnPortfolioQuota));
    }

    private static async Task<IResult> Confirm(
        string portfolioId,
        string assetId,
        ConfirmAssetRequest request,
        HttpContext http,
        AssetService assets,
        IValidator<ConfirmAssetRequest> validator,
        CancellationToken ct)
    {
        var user = http.GetUser();
        var validation = await validator.ValidateAsync(request, ct);
        if (!validation.IsValid)
            return Results.ValidationProblem(validation.ToDictionary());

        var record = await assets.ConfirmAsync(
            user.Uid, portfolioId, assetId,
            request.Filename, request.ContentType, request.ByteSize,
            request.Width, request.Height, ct);

        return Results.Created($"/api/portfolios/{portfolioId}/assets/{record.Id}",
            AssetSummary.From(record));
    }

    private static async Task<IResult> List(
        string portfolioId,
        string? type,
        bool? includeDeleted,
        HttpContext http,
        AssetService assets,
        CancellationToken ct)
    {
        var user = http.GetUser();
        // type query param accepts "image" (matches image/*) or "pdf" (matches application/pdf).
        var contentTypePrefix = type switch
        {
            "image" => "image/",
            "pdf" => "application/pdf",
            _ => null,
        };
        var result = await assets.ListAsync(
            user.Uid, portfolioId, contentTypePrefix, includeDeleted ?? false, ct);
        return Results.Ok(new ListAssetsResponse(
            Assets: result.Assets.Select(AssetSummary.From).ToList(),
            PortfolioBytesUsed: result.PortfolioBytesUsed,
            PortfolioBytesQuota: result.PortfolioBytesQuota,
            WarnPortfolioQuota: result.WarnPortfolioQuota));
    }

    private static async Task<IResult> SoftDelete(
        string portfolioId,
        string assetId,
        HttpContext http,
        AssetService assets,
        CancellationToken ct)
    {
        var user = http.GetUser();
        await assets.SoftDeleteAsync(user.Uid, portfolioId, assetId, ct);
        return Results.NoContent();
    }

    private static async Task<IResult> Restore(
        string portfolioId,
        string assetId,
        HttpContext http,
        AssetService assets,
        CancellationToken ct)
    {
        var user = http.GetUser();
        var record = await assets.RestoreAsync(user.Uid, portfolioId, assetId, ct);
        return Results.Ok(AssetSummary.From(record));
    }

    private static async Task<IResult> PreviewUrls(
        string portfolioId,
        PreviewUrlsRequest request,
        HttpContext http,
        AssetService assets,
        IValidator<PreviewUrlsRequest> validator,
        CancellationToken ct)
    {
        var user = http.GetUser();
        var validation = await validator.ValidateAsync(request, ct);
        if (!validation.IsValid)
            return Results.ValidationProblem(validation.ToDictionary());

        var urls = await assets.MintPreviewUrlsAsync(user.Uid, portfolioId, request.AssetIds, ct);
        return Results.Ok(new PreviewUrlsResponse(
            urls.Select(u => new PreviewUrlEntry(u.AssetId, u.Url.ToString(), u.ExpiresAt)).ToList()));
    }
}
