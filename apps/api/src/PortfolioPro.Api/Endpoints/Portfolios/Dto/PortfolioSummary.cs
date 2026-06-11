using Google.Cloud.Firestore;
using PortfolioPro.Api.Services;

namespace PortfolioPro.Api.Endpoints.Portfolios.Dto;

public sealed record PortfolioSummary(
    string Id,
    string Title,
    string Slug,
    string Description,
    bool IsPublished,
    bool RequiresPassword,
    DateTimeOffset UpdatedAt,
    DateTimeOffset CreatedAt,
    DateTimeOffset? SoftDeletedAt)
{
    public static PortfolioSummary From(PortfolioRecord record) => new(
        Id: record.Id,
        Title: record.Title,
        Slug: record.Slug,
        Description: record.Description,
        IsPublished: record.IsPublished,
        RequiresPassword: record.RequiresPassword,
        UpdatedAt: record.UpdatedAt.ToDateTimeOffset(),
        CreatedAt: record.CreatedAt.ToDateTimeOffset(),
        SoftDeletedAt: record.SoftDeletedAt?.ToDateTimeOffset());
}
