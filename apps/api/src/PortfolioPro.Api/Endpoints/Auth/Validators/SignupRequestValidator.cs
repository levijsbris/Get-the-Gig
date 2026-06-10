using FluentValidation;
using PortfolioPro.Api.Auth;
using PortfolioPro.Api.Endpoints.Auth.Dto;

namespace PortfolioPro.Api.Endpoints.Auth.Validators;

public sealed class SignupRequestValidator : AbstractValidator<SignupRequest>
{
    public SignupRequestValidator()
    {
        RuleFor(x => x.Username)
            .Custom((value, ctx) =>
            {
                var result = UsernameRules.Validate(value);
                if (!result.IsValid)
                    ctx.AddFailure(nameof(SignupRequest.Username), result.Error!);
            });
    }
}
