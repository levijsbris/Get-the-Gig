using FluentValidation;
using PortfolioPro.Api.Endpoints.Portfolios.Assets.Dto;

namespace PortfolioPro.Api.Endpoints.Portfolios.Assets.Validators;

public sealed class PreviewUrlsRequestValidator : AbstractValidator<PreviewUrlsRequest>
{
    public PreviewUrlsRequestValidator()
    {
        RuleFor(x => x.AssetIds)
            .NotNull().WithMessage("assetIds is required.")
            .Must(ids => ids.Count > 0).WithMessage("assetIds must contain at least one id.")
            .Must(ids => ids.All(id => !string.IsNullOrWhiteSpace(id)))
            .WithMessage("assetIds must not contain empty entries.");
    }
}
