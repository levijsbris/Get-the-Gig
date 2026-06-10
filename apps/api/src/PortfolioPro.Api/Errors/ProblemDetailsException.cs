namespace PortfolioPro.Api.Errors;

public class ProblemDetailsException : Exception
{
    public ProblemDetailsException(int statusCode, string title, string detail, string type)
        : base(detail)
    {
        StatusCode = statusCode;
        Title = title;
        Detail = detail;
        Type = type;
    }

    public int StatusCode { get; }
    public string Title { get; }
    public string Detail { get; }
    public string Type { get; }
}
