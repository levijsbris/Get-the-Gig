using System.Net;
using Google.Cloud.Firestore;
using PortfolioPro.Api.Tests.TestFixtures;
using Xunit;
using static PortfolioPro.Api.Tests.TestFixtures.AssetTestHelpers;

namespace PortfolioPro.Api.Tests.Endpoints.Portfolios.Assets;

public sealed class SoftDeleteAssetEndpointTests : EndpointTestBase, IClassFixture<ApiTestFixture>
{
    public SoftDeleteAssetEndpointTests(ApiTestFixture fx) : base(fx) { }

    [Fact]
    public async Task Happy_Path_Decrements_Counters_And_Queues_Hard_Delete()
    {
        var client = Fx.CreateClientFor("uid-alice", "alice@example.com");
        await SignupAsync(client, "alice");
        var portfolio = await CreatePortfolioAsync(client, "x", "x");
        var asset = await UploadFullAsync(Fx, client, portfolio.Id, "p.jpg", "image/jpeg", FakeJpegBytes(4096));

        var response = await client.DeleteAsync($"/api/portfolios/{portfolio.Id}/assets/{asset.Id}");
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);

        var assetDoc = await Fx.Firestore.Collection("users").Document("uid-alice")
            .Collection("assets").Document(asset.Id).GetSnapshotAsync();
        Assert.True(assetDoc.TryGetValue("softDeletedAt", out Timestamp _));

        var portfolioDoc = await Fx.Firestore.Collection("users").Document("uid-alice")
            .Collection("portfolios").Document(portfolio.Id).GetSnapshotAsync();
        Assert.Equal(0L, portfolioDoc.GetValue<long>("storageBytesPortfolio"));

        var userDoc = await Fx.Firestore.Collection("users").Document("uid-alice").GetSnapshotAsync();
        Assert.Equal(0L, userDoc.GetValue<long>("storageBytesUsed"));

        var queueDoc = await Fx.Firestore.Collection("deletionQueue")
            .Document($"asset-{asset.Id}").GetSnapshotAsync();
        Assert.True(queueDoc.Exists);
        Assert.Equal("asset", queueDoc.GetValue<string>("kind"));
    }

    [Fact]
    public async Task Second_Delete_Is_Idempotent_Returns_204()
    {
        var client = Fx.CreateClientFor("uid-alice", "alice@example.com");
        await SignupAsync(client, "alice");
        var portfolio = await CreatePortfolioAsync(client, "x", "x");
        var asset = await UploadFullAsync(Fx, client, portfolio.Id, "p.jpg", "image/jpeg", FakeJpegBytes(1024));

        var first = await client.DeleteAsync($"/api/portfolios/{portfolio.Id}/assets/{asset.Id}");
        Assert.Equal(HttpStatusCode.NoContent, first.StatusCode);
        var second = await client.DeleteAsync($"/api/portfolios/{portfolio.Id}/assets/{asset.Id}");
        Assert.Equal(HttpStatusCode.NoContent, second.StatusCode);
    }

    [Fact]
    public async Task Referenced_In_Draft_Returns_409_With_Reference_Info()
    {
        var client = Fx.CreateClientFor("uid-alice", "alice@example.com");
        await SignupAsync(client, "alice");
        var portfolio = await CreatePortfolioAsync(client, "x", "x");
        var asset = await UploadFullAsync(Fx, client, portfolio.Id, "p.jpg", "image/jpeg", FakeJpegBytes(1024));

        // Phase 4 will populate assetRefsDraft via components; we stuff it directly to
        // exercise the reference-check seam.
        await Fx.Firestore.Collection("users").Document("uid-alice")
            .Collection("portfolios").Document(portfolio.Id)
            .UpdateAsync("assetRefsDraft", new List<string> { asset.Id });

        var response = await client.DeleteAsync($"/api/portfolios/{portfolio.Id}/assets/{asset.Id}");
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        var problem = await response.Content.ReadAsStringAsync();
        Assert.Contains("asset-referenced", problem);
    }

    [Fact]
    public async Task Unknown_Asset_Returns_404()
    {
        var client = Fx.CreateClientFor("uid-alice", "alice@example.com");
        await SignupAsync(client, "alice");
        var portfolio = await CreatePortfolioAsync(client, "x", "x");

        var response = await client.DeleteAsync($"/api/portfolios/{portfolio.Id}/assets/01HMISSING");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Missing_Auth_Returns_401()
    {
        var response = await Fx.CreateAnonymousClient().DeleteAsync(
            "/api/portfolios/any/assets/01H");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }
}
