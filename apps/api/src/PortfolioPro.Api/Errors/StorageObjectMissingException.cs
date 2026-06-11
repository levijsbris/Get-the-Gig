namespace PortfolioPro.Api.Errors;

public sealed class StorageObjectMissingException : ProblemDetailsException
{
    public StorageObjectMissingException(string storagePath)
        : base(
            statusCode: StatusCodes.Status400BadRequest,
            title: "Upload not found in storage",
            detail: $"No object exists at '{storagePath}'. PUT the file to the signed URL before calling confirm.",
            type: "https://portfoliopro.com/errors/upload-missing")
    {
    }
}

public sealed class StorageObjectMismatchException : ProblemDetailsException
{
    public StorageObjectMismatchException(string detail)
        : base(
            statusCode: StatusCodes.Status400BadRequest,
            title: "Upload metadata mismatch",
            detail: detail,
            type: "https://portfoliopro.com/errors/upload-mismatch")
    {
    }
}
