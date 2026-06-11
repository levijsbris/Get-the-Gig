using FluentValidation;
using PortfolioPro.Api.Endpoints.Portfolios.Dto;

namespace PortfolioPro.Api.Endpoints.Portfolios.Validators;

public sealed class UpdatePortfolioRequestValidator : AbstractValidator<UpdatePortfolioRequest>
{
    public UpdatePortfolioRequestValidator()
    {
        RuleFor(x => x)
            .Must(r => r.Title is not null || r.Description is not null || r.Slug is not null)
            .WithMessage("At least one of title, description, or slug must be supplied.");

        RuleFor(x => x.Title!)
            .NotEmpty().WithMessage("Title cannot be empty.")
            .MaximumLength(200).WithMessage("Title must be 200 characters or fewer.")
            .When(x => x.Title is not null);

        RuleFor(x => x.Description!)
            .MaximumLength(500).WithMessage("Description must be 500 characters or fewer.")
            .When(x => x.Description is not null);

        RuleFor(x => x.Slug!)
            .Must(SlugRules.IsValid).WithMessage(SlugRules.ErrorMessage)
            .When(x => x.Slug is not null);
    }
}
