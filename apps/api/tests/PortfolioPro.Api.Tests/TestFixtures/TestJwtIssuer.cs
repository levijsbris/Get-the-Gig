using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using Microsoft.IdentityModel.Tokens;

namespace PortfolioPro.Api.Tests.TestFixtures;

public sealed class TestJwtIssuer : IDisposable
{
    public const string Issuer = "https://portfoliopro.test/issuer";
    public const string Audience = "portfoliopro-test";

    private readonly RSA _rsa;
    private readonly RsaSecurityKey _signingKey;

    public TestJwtIssuer()
    {
        _rsa = RSA.Create(2048);
        _signingKey = new RsaSecurityKey(_rsa) { KeyId = "test-key-1" };
    }

    public SecurityKey PublicKey => _signingKey;

    public string Issue(string uid, string email, TimeSpan? lifetime = null)
    {
        var credentials = new SigningCredentials(_signingKey, SecurityAlgorithms.RsaSha256);
        var token = new JwtSecurityToken(
            issuer: Issuer,
            audience: Audience,
            claims: new[]
            {
                new Claim(JwtRegisteredClaimNames.Sub, uid),
                new Claim("user_id", uid),
                new Claim(JwtRegisteredClaimNames.Email, email),
            },
            notBefore: DateTime.UtcNow.AddMinutes(-1),
            expires: DateTime.UtcNow.Add(lifetime ?? TimeSpan.FromMinutes(10)),
            signingCredentials: credentials);
        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public string IssueExpired(string uid, string email)
    {
        var credentials = new SigningCredentials(_signingKey, SecurityAlgorithms.RsaSha256);
        var token = new JwtSecurityToken(
            issuer: Issuer,
            audience: Audience,
            claims: new[]
            {
                new Claim(JwtRegisteredClaimNames.Sub, uid),
                new Claim("user_id", uid),
                new Claim(JwtRegisteredClaimNames.Email, email),
            },
            notBefore: DateTime.UtcNow.AddHours(-2),
            expires: DateTime.UtcNow.AddHours(-1),
            signingCredentials: credentials);
        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public void Dispose() => _rsa.Dispose();
}
