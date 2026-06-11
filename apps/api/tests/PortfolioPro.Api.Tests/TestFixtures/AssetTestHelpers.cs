using System.Net.Http.Json;
using PortfolioPro.Api.Endpoints.Portfolios.Assets.Dto;

namespace PortfolioPro.Api.Tests.TestFixtures;

internal static class AssetTestHelpers
{
    // 3-byte SOI marker is enough for our tests — fake-gcs stores whatever bytes you
    // give it and the API's HEAD verification only compares size + content-type, not
    // the file's magic numbers.
    public static byte[] FakeJpegBytes(int size = 4096) => Enumerable.Repeat((byte)0xff, size).ToArray();

    public static async Task<UploadUrlResponse> RequestUploadUrlAsync(
        HttpClient client, string portfolioId, string filename, string contentType, long size,
        int? width = null, int? height = null)
    {
        var response = await client.PostAsJsonAsync(
            $"/api/portfolios/{portfolioId}/assets/upload-url",
            new RequestUploadUrlRequest(filename, contentType, size, width, height));
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<UploadUrlResponse>())!;
    }

    public static async Task<AssetSummary> ConfirmAssetAsync(
        HttpClient client, string portfolioId, string assetId,
        string filename, string contentType, long size, int? width = null, int? height = null)
    {
        var response = await client.PostAsJsonAsync(
            $"/api/portfolios/{portfolioId}/assets/{assetId}/confirm",
            new ConfirmAssetRequest(filename, contentType, size, width, height));
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<AssetSummary>())!;
    }

    public static async Task<AssetSummary> UploadFullAsync(
        ApiTestFixture fx, HttpClient client, string portfolioId,
        string filename, string contentType, byte[] bytes, int? width = null, int? height = null)
    {
        var url = await RequestUploadUrlAsync(client, portfolioId, filename, contentType, bytes.Length, width, height);
        await fx.UploadToSignedUrlAsync(url.UploadUrl, url.UploadMethod, bytes, contentType);
        return await ConfirmAssetAsync(client, portfolioId, url.AssetId, filename, contentType, bytes.Length, width, height);
    }
}
