namespace PortfolioPro.Api.Endpoints.Auth.Dto;

public sealed record UsernameAvailabilityResponse(bool Available, string? Reason);
