using System.Net;
using System.Net.Http.Json;
using PortfolioPro.Api.Endpoints.Portfolios.Assets.Dto;
using PortfolioPro.Api.Tests.TestFixtures;
using Xunit;
using static PortfolioPro.Api.Tests.TestFixtures.AssetTestHelpers;

namespace PortfolioPro.Api.Tests.Endpoints.Portfolios.Assets;

/// <summary>
/// End-to-end exercise of the upload pipeline through a real fake-gcs round trip:
/// signup → create portfolio → request URL → PUT bytes to fake-gcs → confirm →
/// list → soft-delete. If this is green, the SignedUrlService, the fake-gcs HEAD
/// verification, and the quota-decrement on delete are all wired correctly.
/// </summary>
public sealed class AssetUploadEndToEndTests : EndpointTestBase, IClassFixture<ApiTestFixture>
{
    public AssetUploadEndToEndTests(ApiTestFixture fx) : base(fx) { }

    [Fact]
    public async Task Full_Round_Trip_Upload_List_Delete()
    {
        var client = Fx.CreateClientFor("uid-alice", "alice@example.com");
        await SignupAsync(client, "alice");
        var portfolio = await CreatePortfolioAsync(client, "Resume", "resume");

        // 1) Request the upload URL.
        var bytes = FakeJpegBytes(16384);
        var urlResponse = await RequestUploadUrlAsync(
            client, portfolio.Id, "headshot.jpg", "image/jpeg", bytes.Length, 1024, 768);
        Assert.NotEmpty(urlResponse.AssetId);
        Assert.Equal(16384, urlResponse.PortfolioBytesAfterUpload);

        // 2) Upload the bytes to fake-gcs at the supplied URL using the returned method.
        await Fx.UploadToSignedUrlAsync(
            urlResponse.UploadUrl, urlResponse.UploadMethod, bytes, "image/jpeg");

        // 3) Confirm. The API HEADs fake-gcs, verifies size + content-type, then
        //    writes the asset doc and bumps counters in a transaction.
        var asset = await ConfirmAssetAsync(
            client, portfolio.Id, urlResponse.AssetId,
            "headshot.jpg", "image/jpeg", bytes.Length, 1024, 768);
        Assert.Equal(16384, asset.ByteSize);
        Assert.Equal(1024, asset.Width);
        Assert.Equal(768, asset.Height);

        // 4) List shows the asset and quota is correct.
        var list = await client.GetFromJsonOrThrowAsync<ListAssetsResponse>(
            $"/api/portfolios/{portfolio.Id}/assets");
        Assert.Single(list.Assets);
        Assert.Equal(asset.Id, list.Assets[0].Id);
        Assert.Equal(16384, list.PortfolioBytesUsed);

        // 5) Soft-delete and confirm bytes are reclaimed.
        var delete = await client.DeleteAsync($"/api/portfolios/{portfolio.Id}/assets/{asset.Id}");
        Assert.Equal(HttpStatusCode.NoContent, delete.StatusCode);

        var listAfter = await client.GetFromJsonOrThrowAsync<ListAssetsResponse>(
            $"/api/portfolios/{portfolio.Id}/assets");
        Assert.Empty(listAfter.Assets);
        Assert.Equal(0, listAfter.PortfolioBytesUsed);
    }
}

internal static class HttpClientJsonExtensions
{
    public static async Task<T> GetFromJsonOrThrowAsync<T>(this HttpClient client, string url)
    {
        var response = await client.GetAsync(url);
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<T>())!;
    }
}
