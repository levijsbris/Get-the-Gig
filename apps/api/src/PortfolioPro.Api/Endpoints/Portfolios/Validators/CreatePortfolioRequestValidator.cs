using FluentValidation;
using PortfolioPro.Api.Endpoints.Portfolios.Dto;

namespace PortfolioPro.Api.Endpoints.Portfolios.Validators;

public sealed class CreatePortfolioRequestValidator : AbstractValidator<CreatePortfolioRequest>
{
    public CreatePortfolioRequestValidator()
    {
        RuleFor(x => x.Title)
            .NotEmpty().WithMessage("Title is required.")
            .MaximumLength(200).WithMessage("Title must be 200 characters or fewer.");

        RuleFor(x => x.Slug)
            .Must(SlugRules.IsValid).WithMessage(SlugRules.ErrorMessage);

        RuleFor(x => x.Description)
            .MaximumLength(500).WithMessage("Description must be 500 characters or fewer.")
            .When(x => x.Description is not null);
    }
}
