using System.Text.Json;

namespace PortfolioPro.Api.Endpoints.Portfolios.Drafts.Dto;

public sealed record UpdateDraftRequest(JsonElement Draft, int DraftSchemaVersion);
