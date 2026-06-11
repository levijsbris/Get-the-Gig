using System.Net;
using System.Net.Http.Json;
using PortfolioPro.Api.Endpoints.Portfolios.Assets.Dto;
using PortfolioPro.Api.Tests.TestFixtures;
using Xunit;
using static PortfolioPro.Api.Tests.TestFixtures.AssetTestHelpers;

namespace PortfolioPro.Api.Tests.Endpoints.Portfolios.Assets;

public sealed class ConfirmAssetEndpointTests : EndpointTestBase, IClassFixture<ApiTestFixture>
{
    public ConfirmAssetEndpointTests(ApiTestFixture fx) : base(fx) { }

    [Fact]
    public async Task Happy_Path_Creates_Asset_Doc_And_Increments_Counters()
    {
        var client = Fx.CreateClientFor("uid-alice", "alice@example.com");
        await SignupAsync(client, "alice");
        var portfolio = await CreatePortfolioAsync(client, "Resume", "resume");

        var bytes = FakeJpegBytes(8192);
        var asset = await UploadFullAsync(Fx, client, portfolio.Id, "photo.jpg", "image/jpeg", bytes, 800, 600);

        Assert.Equal("photo.jpg", asset.Filename);
        Assert.Equal(8192, asset.ByteSize);

        var assetDoc = await Fx.Firestore.Collection("users").Document("uid-alice")
            .Collection("assets").Document(asset.Id).GetSnapshotAsync();
        Assert.True(assetDoc.Exists);
        Assert.Equal(portfolio.Id, assetDoc.GetValue<string>("ownerPortfolioId"));
        Assert.Equal($"gs://{ApiTestFixture.TestBucket}/users/uid-alice/assets/{asset.Id}/photo.jpg",
            assetDoc.GetValue<string>("storagePath"));

        var portfolioDoc = await Fx.Firestore.Collection("users").Document("uid-alice")
            .Collection("portfolios").Document(portfolio.Id).GetSnapshotAsync();
        Assert.Equal(8192L, portfolioDoc.GetValue<long>("storageBytesPortfolio"));

        var userDoc = await Fx.Firestore.Collection("users").Document("uid-alice").GetSnapshotAsync();
        Assert.Equal(8192L, userDoc.GetValue<long>("storageBytesUsed"));
    }

    [Fact]
    public async Task Missing_Object_In_Storage_Returns_400()
    {
        var client = Fx.CreateClientFor("uid-alice", "alice@example.com");
        await SignupAsync(client, "alice");
        var portfolio = await CreatePortfolioAsync(client, "x", "x");

        var url = await RequestUploadUrlAsync(client, portfolio.Id, "photo.jpg", "image/jpeg", 1000);
        // Do NOT upload to the URL — skip straight to confirm.

        var response = await client.PostAsJsonAsync(
            $"/api/portfolios/{portfolio.Id}/assets/{url.AssetId}/confirm",
            new ConfirmAssetRequest("photo.jpg", "image/jpeg", 1000, null, null));
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await response.Content.ReadAsStringAsync();
        Assert.Contains("upload-missing", problem);
    }

    [Fact]
    public async Task Size_Mismatch_Returns_400()
    {
        var client = Fx.CreateClientFor("uid-alice", "alice@example.com");
        await SignupAsync(client, "alice");
        var portfolio = await CreatePortfolioAsync(client, "x", "x");

        var bytes = FakeJpegBytes(100);
        var url = await RequestUploadUrlAsync(client, portfolio.Id, "photo.jpg", "image/jpeg", 100);
        await Fx.UploadToSignedUrlAsync(url.UploadUrl, url.UploadMethod, bytes, "image/jpeg");

        // Confirm claiming a different size.
        var response = await client.PostAsJsonAsync(
            $"/api/portfolios/{portfolio.Id}/assets/{url.AssetId}/confirm",
            new ConfirmAssetRequest("photo.jpg", "image/jpeg", 99999, null, null));
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await response.Content.ReadAsStringAsync();
        Assert.Contains("upload-mismatch", problem);
    }

    [Fact]
    public async Task Missing_Auth_Returns_401()
    {
        var response = await Fx.CreateAnonymousClient().PostAsJsonAsync(
            "/api/portfolios/any/assets/01H/confirm",
            new ConfirmAssetRequest("p.jpg", "image/jpeg", 1, null, null));
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }
}
