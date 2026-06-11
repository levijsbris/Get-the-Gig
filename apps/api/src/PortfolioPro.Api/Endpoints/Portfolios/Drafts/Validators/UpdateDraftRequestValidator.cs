using System.Text.Json;
using FluentValidation;
using PortfolioPro.Api.Endpoints.Portfolios.Drafts.Dto;

namespace PortfolioPro.Api.Endpoints.Portfolios.Drafts.Validators;

public sealed class UpdateDraftRequestValidator : AbstractValidator<UpdateDraftRequest>
{
    public UpdateDraftRequestValidator()
    {
        RuleFor(x => x.Draft)
            .Must(draft => draft.ValueKind == JsonValueKind.Object)
            .WithMessage("draft must be a JSON object.");

        RuleFor(x => x.DraftSchemaVersion)
            .GreaterThan(0)
            .WithMessage("draftSchemaVersion must be a positive integer.");
    }
}
