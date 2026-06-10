using FirebaseAdmin.Auth;

namespace PortfolioPro.Api.Auth;

public sealed class FirebaseIdTokenValidator : IIdTokenValidator
{
    public async Task<IdTokenInfo> ValidateAsync(string token, CancellationToken ct)
    {
        FirebaseToken decoded;
        try
        {
            decoded = await FirebaseAuth.DefaultInstance.VerifyIdTokenAsync(token, ct);
        }
        catch (FirebaseAuthException ex)
        {
            throw new InvalidIdTokenException("Firebase ID token failed verification.", ex);
        }

        if (!decoded.Claims.TryGetValue("email", out var emailObj) || emailObj is not string email || string.IsNullOrWhiteSpace(email))
            throw new InvalidIdTokenException("Token did not contain an email claim.");

        return new IdTokenInfo(decoded.Uid, email);
    }
}
