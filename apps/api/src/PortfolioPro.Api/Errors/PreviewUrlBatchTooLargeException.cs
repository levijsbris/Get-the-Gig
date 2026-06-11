namespace PortfolioPro.Api.Errors;

public sealed class PreviewUrlBatchTooLargeException : ProblemDetailsException
{
    public PreviewUrlBatchTooLargeException(int maxBatch)
        : base(
            statusCode: StatusCodes.Status400BadRequest,
            title: "Preview URL batch too large",
            detail: $"Request at most {maxBatch} asset ids per call.",
            type: "https://portfoliopro.com/errors/preview-batch-too-large")
    {
    }
}
