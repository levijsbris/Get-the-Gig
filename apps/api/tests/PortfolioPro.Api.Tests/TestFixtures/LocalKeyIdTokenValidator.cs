using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.IdentityModel.Tokens;
using PortfolioPro.Api.Auth;

namespace PortfolioPro.Api.Tests.TestFixtures;

public sealed class LocalKeyIdTokenValidator(TestJwtIssuer issuer) : IIdTokenValidator
{
    private readonly TokenValidationParameters _params = new()
    {
        ValidIssuer = TestJwtIssuer.Issuer,
        ValidAudience = TestJwtIssuer.Audience,
        IssuerSigningKey = issuer.PublicKey,
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ClockSkew = TimeSpan.Zero,
    };

    public Task<IdTokenInfo> ValidateAsync(string token, CancellationToken ct)
    {
        var handler = new JwtSecurityTokenHandler();
        ClaimsPrincipal principal;
        try
        {
            principal = handler.ValidateToken(token, _params, out _);
        }
        catch (SecurityTokenException ex)
        {
            throw new InvalidIdTokenException("Test token failed validation.", ex);
        }

        var uid = principal.FindFirstValue("user_id") ?? principal.FindFirstValue(JwtRegisteredClaimNames.Sub);
        var email = principal.FindFirstValue(JwtRegisteredClaimNames.Email)
            ?? principal.FindFirstValue(ClaimTypes.Email);
        if (string.IsNullOrEmpty(uid) || string.IsNullOrEmpty(email))
            throw new InvalidIdTokenException("Token missing required claims.");

        return Task.FromResult(new IdTokenInfo(uid, email));
    }
}
