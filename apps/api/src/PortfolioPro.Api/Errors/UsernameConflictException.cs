namespace PortfolioPro.Api.Errors;

public sealed class UsernameConflictException : ProblemDetailsException
{
    public UsernameConflictException(string username)
        : base(
            statusCode: StatusCodes.Status409Conflict,
            title: "Username already taken",
            detail: $"The username '{username}' is already claimed.",
            type: "https://portfoliopro.com/errors/username-conflict")
    {
    }
}
