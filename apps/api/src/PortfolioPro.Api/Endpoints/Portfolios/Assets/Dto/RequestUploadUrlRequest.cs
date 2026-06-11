namespace PortfolioPro.Api.Endpoints.Portfolios.Assets.Dto;

public sealed record RequestUploadUrlRequest(
    string Filename,
    string ContentType,
    long ByteSize,
    int? Width,
    int? Height);
