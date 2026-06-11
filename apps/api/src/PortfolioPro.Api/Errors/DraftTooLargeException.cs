namespace PortfolioPro.Api.Errors;

public sealed class DraftTooLargeException : ProblemDetailsException
{
    public DraftTooLargeException(long actualBytes, long maxBytes)
        : base(
            statusCode: StatusCodes.Status400BadRequest,
            title: "Draft is too large",
            detail: $"Draft is {actualBytes} bytes; the hard cap is {maxBytes} ({maxBytes / 1024} KB) " +
                "to stay safely under the Firestore 1 MiB document limit.",
            type: "https://portfoliopro.com/errors/draft-too-large")
    {
    }
}
