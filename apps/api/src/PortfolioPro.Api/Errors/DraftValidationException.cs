namespace PortfolioPro.Api.Errors;

public sealed class DraftValidationException : ProblemDetailsException
{
    public DraftValidationException(IReadOnlyList<string> errors)
        : base(
            statusCode: StatusCodes.Status400BadRequest,
            title: "Draft failed schema validation",
            detail: BuildDetail(errors),
            type: "https://portfoliopro.com/errors/draft-validation")
    {
        Errors = errors;
    }

    public IReadOnlyList<string> Errors { get; }

    private static string BuildDetail(IReadOnlyList<string> errors)
    {
        if (errors.Count == 0) return "Draft did not match the snapshot JSON Schema.";
        var preview = string.Join("; ", errors.Take(3));
        return errors.Count > 3
            ? $"{preview}; …and {errors.Count - 3} more."
            : preview;
    }
}
