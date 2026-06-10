namespace PortfolioPro.Api.Errors;

public sealed class AccountAlreadyExistsException : ProblemDetailsException
{
    public AccountAlreadyExistsException()
        : base(
            statusCode: StatusCodes.Status409Conflict,
            title: "Account already exists",
            detail: "This user already has a server-side account; call /api/auth/me instead.",
            type: "https://portfoliopro.com/errors/account-exists")
    {
    }
}
