using Google.Cloud.Firestore;

namespace PortfolioPro.Api.Services;

public sealed record PortfolioRecord(
    string Id,
    string Uid,
    string Slug,
    string Title,
    string Description,
    bool IsPublished,
    bool RequiresPassword,
    Timestamp CreatedAt,
    Timestamp UpdatedAt,
    Timestamp? SoftDeletedAt);
