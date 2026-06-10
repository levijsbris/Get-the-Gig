namespace PortfolioPro.Api.Auth;

public interface IIdTokenValidator
{
    Task<IdTokenInfo> ValidateAsync(string token, CancellationToken ct);
}

public sealed record IdTokenInfo(string Uid, string Email);

public sealed class InvalidIdTokenException : Exception
{
    public InvalidIdTokenException(string message) : base(message) { }
    public InvalidIdTokenException(string message, Exception inner) : base(message, inner) { }
}
