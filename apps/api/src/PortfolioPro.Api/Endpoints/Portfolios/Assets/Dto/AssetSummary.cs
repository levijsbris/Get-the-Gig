using PortfolioPro.Api.Services;

namespace PortfolioPro.Api.Endpoints.Portfolios.Assets.Dto;

public sealed record AssetSummary(
    string Id,
    string Filename,
    string ContentType,
    long ByteSize,
    int? Width,
    int? Height,
    DateTimeOffset CreatedAt,
    DateTimeOffset? SoftDeletedAt)
{
    public static AssetSummary From(AssetRecord r) => new(
        Id: r.Id,
        Filename: r.Filename,
        ContentType: r.ContentType,
        ByteSize: r.ByteSize,
        Width: r.Width,
        Height: r.Height,
        CreatedAt: r.CreatedAt.ToDateTimeOffset(),
        SoftDeletedAt: r.SoftDeletedAt?.ToDateTimeOffset());
}
