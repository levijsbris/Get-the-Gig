namespace PortfolioPro.Api.Errors;

public sealed class SlugConflictException : ProblemDetailsException
{
    public SlugConflictException(string slug)
        : base(
            statusCode: StatusCodes.Status409Conflict,
            title: "Slug already in use",
            detail: $"The slug '{slug}' is already claimed by another portfolio of yours.",
            type: "https://portfoliopro.com/errors/slug-conflict")
    {
    }
}
