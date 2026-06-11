using System.Net;
using System.Net.Http.Json;
using Google.Cloud.Firestore;
using PortfolioPro.Api.Endpoints.Portfolios.Assets.Dto;
using PortfolioPro.Api.Services;
using PortfolioPro.Api.Tests.TestFixtures;
using Xunit;
using static PortfolioPro.Api.Tests.TestFixtures.AssetTestHelpers;

namespace PortfolioPro.Api.Tests.Endpoints.Portfolios.Assets;

public sealed class RestoreAssetEndpointTests : EndpointTestBase, IClassFixture<ApiTestFixture>
{
    public RestoreAssetEndpointTests(ApiTestFixture fx) : base(fx) { }

    [Fact]
    public async Task Restore_Within_Grace_Clears_SoftDeletedAt_And_Re_Increments_Counters()
    {
        var client = Fx.CreateClientFor("uid-alice", "alice@example.com");
        await SignupAsync(client, "alice");
        var portfolio = await CreatePortfolioAsync(client, "x", "x");
        var asset = await UploadFullAsync(Fx, client, portfolio.Id, "p.jpg", "image/jpeg", FakeJpegBytes(4096));

        var del = await client.DeleteAsync($"/api/portfolios/{portfolio.Id}/assets/{asset.Id}");
        del.EnsureSuccessStatusCode();

        Fx.Clock.Advance(TimeSpan.FromDays(3));

        var response = await client.PostAsync($"/api/portfolios/{portfolio.Id}/assets/{asset.Id}/restore", content: null);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<AssetSummary>();
        Assert.NotNull(body);
        Assert.Null(body!.SoftDeletedAt);

        var assetDoc = await Fx.Firestore.Collection("users").Document("uid-alice")
            .Collection("assets").Document(asset.Id).GetSnapshotAsync();
        // After restore the field is written as explicit null, and Firestore's
        // TryGetValue<Timestamp> throws on null values — read the raw dictionary.
        var assetData = assetDoc.ToDictionary();
        Assert.True(assetData.TryGetValue("softDeletedAt", out var sdRaw));
        Assert.Null(sdRaw);

        var portfolioDoc = await Fx.Firestore.Collection("users").Document("uid-alice")
            .Collection("portfolios").Document(portfolio.Id).GetSnapshotAsync();
        Assert.Equal(4096L, portfolioDoc.GetValue<long>("storageBytesPortfolio"));

        var userDoc = await Fx.Firestore.Collection("users").Document("uid-alice").GetSnapshotAsync();
        Assert.Equal(4096L, userDoc.GetValue<long>("storageBytesUsed"));

        var queueDoc = await Fx.Firestore.Collection("deletionQueue")
            .Document($"asset-{asset.Id}").GetSnapshotAsync();
        Assert.False(queueDoc.Exists);
    }

    [Fact]
    public async Task Restore_Past_7_Day_Grace_Returns_409_GracePeriodExpired()
    {
        var client = Fx.CreateClientFor("uid-alice", "alice@example.com");
        await SignupAsync(client, "alice");
        var portfolio = await CreatePortfolioAsync(client, "x", "x");
        var asset = await UploadFullAsync(Fx, client, portfolio.Id, "p.jpg", "image/jpeg", FakeJpegBytes(1024));

        var del = await client.DeleteAsync($"/api/portfolios/{portfolio.Id}/assets/{asset.Id}");
        del.EnsureSuccessStatusCode();

        Fx.Clock.Advance(TimeSpan.FromDays(8));

        var response = await client.PostAsync($"/api/portfolios/{portfolio.Id}/assets/{asset.Id}/restore", content: null);
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        var problem = await response.Content.ReadAsStringAsync();
        Assert.Contains("grace-period-expired", problem);
    }

    [Fact]
    public async Task Restore_Of_Live_Asset_Returns_409_NotSoftDeleted()
    {
        var client = Fx.CreateClientFor("uid-alice", "alice@example.com");
        await SignupAsync(client, "alice");
        var portfolio = await CreatePortfolioAsync(client, "x", "x");
        var asset = await UploadFullAsync(Fx, client, portfolio.Id, "p.jpg", "image/jpeg", FakeJpegBytes(1024));

        var response = await client.PostAsync($"/api/portfolios/{portfolio.Id}/assets/{asset.Id}/restore", content: null);
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        var problem = await response.Content.ReadAsStringAsync();
        Assert.Contains("not-soft-deleted", problem);
    }

    [Fact]
    public async Task Restore_Past_Quota_Returns_409_QuotaExceeded()
    {
        var client = Fx.CreateClientFor("uid-alice", "alice@example.com");
        await SignupAsync(client, "alice");
        var portfolio = await CreatePortfolioAsync(client, "x", "x");
        var asset = await UploadFullAsync(Fx, client, portfolio.Id, "p.jpg", "image/jpeg", FakeJpegBytes(4096));

        var del = await client.DeleteAsync($"/api/portfolios/{portfolio.Id}/assets/{asset.Id}");
        del.EnsureSuccessStatusCode();

        // Simulate the user filling the quota with other uploads while the asset was
        // in trash — restoring would push past the hard cap.
        await Fx.Firestore.Collection("users").Document("uid-alice")
            .Collection("portfolios").Document(portfolio.Id)
            .UpdateAsync("storageBytesPortfolio", AssetLimits.PortfolioHardCapBytes - 1);

        var response = await client.PostAsync($"/api/portfolios/{portfolio.Id}/assets/{asset.Id}/restore", content: null);
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        var problem = await response.Content.ReadAsStringAsync();
        Assert.Contains("quota-exceeded", problem);
    }

    [Fact]
    public async Task Restore_Unknown_Asset_Returns_404()
    {
        var client = Fx.CreateClientFor("uid-alice", "alice@example.com");
        await SignupAsync(client, "alice");
        var portfolio = await CreatePortfolioAsync(client, "x", "x");

        var response = await client.PostAsync(
            $"/api/portfolios/{portfolio.Id}/assets/01HMISSING/restore", content: null);
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Restore_Missing_Auth_Returns_401()
    {
        var response = await Fx.CreateAnonymousClient()
            .PostAsync("/api/portfolios/any/assets/any/restore", content: null);
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task List_With_IncludeDeleted_Shows_Soft_Deleted_Assets()
    {
        var client = Fx.CreateClientFor("uid-alice", "alice@example.com");
        await SignupAsync(client, "alice");
        var portfolio = await CreatePortfolioAsync(client, "x", "x");
        var live = await UploadFullAsync(Fx, client, portfolio.Id, "live.jpg", "image/jpeg", FakeJpegBytes(1024));
        var doomed = await UploadFullAsync(Fx, client, portfolio.Id, "doomed.jpg", "image/jpeg", FakeJpegBytes(2048));

        var del = await client.DeleteAsync($"/api/portfolios/{portfolio.Id}/assets/{doomed.Id}");
        del.EnsureSuccessStatusCode();

        var defaultResponse = await client.GetAsync($"/api/portfolios/{portfolio.Id}/assets");
        var defaultBody = await defaultResponse.Content.ReadFromJsonAsync<ListAssetsResponse>();
        Assert.Single(defaultBody!.Assets);
        Assert.Equal(live.Id, defaultBody.Assets[0].Id);

        var withDeletedResponse = await client.GetAsync($"/api/portfolios/{portfolio.Id}/assets?includeDeleted=true");
        var withDeletedBody = await withDeletedResponse.Content.ReadFromJsonAsync<ListAssetsResponse>();
        Assert.Equal(2, withDeletedBody!.Assets.Count);
        var trashed = withDeletedBody.Assets.Single(a => a.Id == doomed.Id);
        Assert.NotNull(trashed.SoftDeletedAt);
    }
}
