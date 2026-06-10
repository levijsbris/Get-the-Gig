namespace PortfolioPro.Api.Errors;

public sealed class UserNotFoundException : ProblemDetailsException
{
    public UserNotFoundException()
        : base(
            statusCode: StatusCodes.Status404NotFound,
            title: "User not found",
            detail: "No user document exists for the authenticated UID.",
            type: "https://portfoliopro.com/errors/user-not-found")
    {
    }
}
