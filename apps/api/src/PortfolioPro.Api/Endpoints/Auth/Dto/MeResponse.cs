using PortfolioPro.Api.Services;

namespace PortfolioPro.Api.Endpoints.Auth.Dto;

public sealed record MeResponse(string Uid, string Email, string? Username, bool HasAccount)
{
    public static MeResponse From(string uid, string email, UserRecord? record) =>
        record is null
            ? new MeResponse(uid, email, Username: null, HasAccount: false)
            : new MeResponse(record.Uid, record.Email, record.Username, HasAccount: true);
}
