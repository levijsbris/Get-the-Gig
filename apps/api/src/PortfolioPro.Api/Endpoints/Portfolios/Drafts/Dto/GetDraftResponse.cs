namespace PortfolioPro.Api.Endpoints.Portfolios.Drafts.Dto;

public sealed record GetDraftResponse(
    object Draft,
    DateTimeOffset DraftUpdatedAt,
    int DraftSchemaVersion);
