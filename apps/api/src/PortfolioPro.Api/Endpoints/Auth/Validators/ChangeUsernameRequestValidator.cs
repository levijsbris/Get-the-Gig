using FluentValidation;
using PortfolioPro.Api.Auth;
using PortfolioPro.Api.Endpoints.Auth.Dto;

namespace PortfolioPro.Api.Endpoints.Auth.Validators;

public sealed class ChangeUsernameRequestValidator : AbstractValidator<ChangeUsernameRequest>
{
    public ChangeUsernameRequestValidator()
    {
        RuleFor(x => x.NewUsername)
            .Custom((value, ctx) =>
            {
                var result = UsernameRules.Validate(value);
                if (!result.IsValid)
                    ctx.AddFailure(nameof(ChangeUsernameRequest.NewUsername), result.Error!);
            });
    }
}
