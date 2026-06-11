using System.Net;
using System.Net.Http.Json;
using PortfolioPro.Api.Endpoints.Portfolios.Assets.Dto;
using PortfolioPro.Api.Tests.TestFixtures;
using Xunit;
using static PortfolioPro.Api.Tests.TestFixtures.AssetTestHelpers;

namespace PortfolioPro.Api.Tests.Endpoints.Portfolios.Assets;

public sealed class PreviewUrlsEndpointTests : EndpointTestBase, IClassFixture<ApiTestFixture>
{
    public PreviewUrlsEndpointTests(ApiTestFixture fx) : base(fx) { }

    [Fact]
    public async Task Happy_Path_Returns_One_Entry_Per_Owned_Asset()
    {
        var client = Fx.CreateClientFor("uid-alice", "alice@example.com");
        await SignupAsync(client, "alice");
        var portfolio = await CreatePortfolioAsync(client, "Resume", "resume");

        var first = await UploadFullAsync(Fx, client, portfolio.Id, "a.jpg", "image/jpeg", FakeJpegBytes(1024));
        var second = await UploadFullAsync(Fx, client, portfolio.Id, "b.jpg", "image/jpeg", FakeJpegBytes(2048));

        var response = await client.PostAsJsonAsync(
            $"/api/portfolios/{portfolio.Id}/assets/preview-urls",
            new PreviewUrlsRequest(new[] { first.Id, second.Id }));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<PreviewUrlsResponse>();
        Assert.NotNull(body);
        Assert.Equal(2, body!.Urls.Count);

        var firstEntry = body.Urls.Single(u => u.AssetId == first.Id);
        Assert.StartsWith(Fx.FakeGcsBaseUrl.TrimEnd('/'), firstEntry.Url, StringComparison.Ordinal);
        Assert.Contains("alt=media", firstEntry.Url);
        Assert.True(firstEntry.ExpiresAt > DateTimeOffset.MinValue);
    }

    [Fact]
    public async Task Missing_Asset_Ids_Are_Skipped_Silently()
    {
        var client = Fx.CreateClientFor("uid-alice", "alice@example.com");
        await SignupAsync(client, "alice");
        var portfolio = await CreatePortfolioAsync(client, "x", "x");
        var asset = await UploadFullAsync(Fx, client, portfolio.Id, "a.jpg", "image/jpeg", FakeJpegBytes(1024));

        var response = await client.PostAsJsonAsync(
            $"/api/portfolios/{portfolio.Id}/assets/preview-urls",
            new PreviewUrlsRequest(new[] { asset.Id, "01HNEVEREXISTED" }));

        var body = await response.Content.ReadFromJsonAsync<PreviewUrlsResponse>();
        Assert.NotNull(body);
        // The missing id is omitted rather than failing the whole batch — client
        // treats absence as "no preview available for that asset id".
        Assert.Single(body!.Urls);
        Assert.Equal(asset.Id, body.Urls[0].AssetId);
    }

    [Fact]
    public async Task Asset_From_Other_Portfolio_Of_Same_User_Is_Skipped()
    {
        var client = Fx.CreateClientFor("uid-alice", "alice@example.com");
        await SignupAsync(client, "alice");
        var resume = await CreatePortfolioAsync(client, "Resume", "resume");
        var portfolio2 = await CreatePortfolioAsync(client, "Side", "side");

        var resumeAsset = await UploadFullAsync(Fx, client, resume.Id, "r.jpg", "image/jpeg", FakeJpegBytes(1024));

        // Ask for the resume asset under the OTHER portfolio's URL.
        var response = await client.PostAsJsonAsync(
            $"/api/portfolios/{portfolio2.Id}/assets/preview-urls",
            new PreviewUrlsRequest(new[] { resumeAsset.Id }));

        var body = await response.Content.ReadFromJsonAsync<PreviewUrlsResponse>();
        Assert.Empty(body!.Urls);
    }

    [Fact]
    public async Task Soft_Deleted_Assets_Still_Get_Preview_Urls_For_Trash_View()
    {
        var client = Fx.CreateClientFor("uid-alice", "alice@example.com");
        await SignupAsync(client, "alice");
        var portfolio = await CreatePortfolioAsync(client, "x", "x");
        var asset = await UploadFullAsync(Fx, client, portfolio.Id, "a.jpg", "image/jpeg", FakeJpegBytes(1024));

        var del = await client.DeleteAsync($"/api/portfolios/{portfolio.Id}/assets/{asset.Id}");
        del.EnsureSuccessStatusCode();

        var response = await client.PostAsJsonAsync(
            $"/api/portfolios/{portfolio.Id}/assets/preview-urls",
            new PreviewUrlsRequest(new[] { asset.Id }));
        var body = await response.Content.ReadFromJsonAsync<PreviewUrlsResponse>();
        Assert.Single(body!.Urls);
    }

    [Fact]
    public async Task ExpiresAt_Is_Roughly_Now_Plus_TTL()
    {
        var client = Fx.CreateClientFor("uid-alice", "alice@example.com");
        await SignupAsync(client, "alice");
        var portfolio = await CreatePortfolioAsync(client, "x", "x");
        var asset = await UploadFullAsync(Fx, client, portfolio.Id, "a.jpg", "image/jpeg", FakeJpegBytes(1024));

        var response = await client.PostAsJsonAsync(
            $"/api/portfolios/{portfolio.Id}/assets/preview-urls",
            new PreviewUrlsRequest(new[] { asset.Id }));
        var body = await response.Content.ReadFromJsonAsync<PreviewUrlsResponse>();

        // FakeClock is fixed at 2026-01-01 12:00 UTC; TTL is 14 minutes.
        var expectedExpiry = Fx.Clock.UtcNow.AddMinutes(14);
        Assert.Equal(expectedExpiry, body!.Urls[0].ExpiresAt);
    }

    [Fact]
    public async Task Empty_AssetIds_Returns_400()
    {
        var client = Fx.CreateClientFor("uid-alice", "alice@example.com");
        await SignupAsync(client, "alice");
        var portfolio = await CreatePortfolioAsync(client, "x", "x");

        var response = await client.PostAsJsonAsync(
            $"/api/portfolios/{portfolio.Id}/assets/preview-urls",
            new PreviewUrlsRequest(Array.Empty<string>()));
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Too_Many_Asset_Ids_Returns_400_Batch_Too_Large()
    {
        var client = Fx.CreateClientFor("uid-alice", "alice@example.com");
        await SignupAsync(client, "alice");
        var portfolio = await CreatePortfolioAsync(client, "x", "x");

        var ids = Enumerable.Range(0, 101).Select(i => $"01HMOCK{i:000}").ToArray();
        var response = await client.PostAsJsonAsync(
            $"/api/portfolios/{portfolio.Id}/assets/preview-urls",
            new PreviewUrlsRequest(ids));
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await response.Content.ReadAsStringAsync();
        Assert.Contains("preview-batch-too-large", problem);
    }

    [Fact]
    public async Task Missing_Auth_Returns_401()
    {
        var response = await Fx.CreateAnonymousClient().PostAsJsonAsync(
            "/api/portfolios/any/assets/preview-urls",
            new PreviewUrlsRequest(new[] { "01H" }));
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Cross_Tenant_Asset_Id_Is_Skipped()
    {
        var alice = Fx.CreateClientFor("uid-alice", "alice@example.com");
        var bob = Fx.CreateClientFor("uid-bob", "bob@example.com");
        await SignupAsync(alice, "alice");
        await SignupAsync(bob, "bob");

        var alicePortfolio = await CreatePortfolioAsync(alice, "Alice", "alice");
        var bobPortfolio = await CreatePortfolioAsync(bob, "Bob", "bob");
        var aliceAsset = await UploadFullAsync(Fx, alice, alicePortfolio.Id, "a.jpg", "image/jpeg", FakeJpegBytes(1024));

        // Bob asks for Alice's asset id under his own portfolio.
        var response = await bob.PostAsJsonAsync(
            $"/api/portfolios/{bobPortfolio.Id}/assets/preview-urls",
            new PreviewUrlsRequest(new[] { aliceAsset.Id }));
        var body = await response.Content.ReadFromJsonAsync<PreviewUrlsResponse>();
        Assert.Empty(body!.Urls);
    }
}
