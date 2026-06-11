using System.Net;
using System.Net.Http.Json;
using PortfolioPro.Api.Endpoints.Portfolios.Assets.Dto;
using PortfolioPro.Api.Tests.TestFixtures;
using Xunit;
using static PortfolioPro.Api.Tests.TestFixtures.AssetTestHelpers;

namespace PortfolioPro.Api.Tests.Endpoints.Portfolios.Assets;

public sealed class ListAssetsEndpointTests : EndpointTestBase, IClassFixture<ApiTestFixture>
{
    public ListAssetsEndpointTests(ApiTestFixture fx) : base(fx) { }

    [Fact]
    public async Task Empty_Initially_With_Zero_Bytes_Used()
    {
        var client = Fx.CreateClientFor("uid-alice", "alice@example.com");
        await SignupAsync(client, "alice");
        var portfolio = await CreatePortfolioAsync(client, "x", "x");

        var response = await client.GetAsync($"/api/portfolios/{portfolio.Id}/assets");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<ListAssetsResponse>();
        Assert.Empty(body!.Assets);
        Assert.Equal(0, body.PortfolioBytesUsed);
        Assert.False(body.WarnPortfolioQuota);
    }

    [Fact]
    public async Task Returns_Uploaded_Assets_Newest_First()
    {
        var client = Fx.CreateClientFor("uid-alice", "alice@example.com");
        await SignupAsync(client, "alice");
        var portfolio = await CreatePortfolioAsync(client, "x", "x");

        var first = await UploadFullAsync(Fx, client, portfolio.Id, "first.jpg", "image/jpeg", FakeJpegBytes(1024));
        Fx.Clock.Advance(TimeSpan.FromSeconds(5));
        var second = await UploadFullAsync(Fx, client, portfolio.Id, "second.jpg", "image/jpeg", FakeJpegBytes(1024));

        var response = await client.GetAsync($"/api/portfolios/{portfolio.Id}/assets");
        var body = await response.Content.ReadFromJsonAsync<ListAssetsResponse>();
        Assert.NotNull(body);
        Assert.Equal(2, body!.Assets.Count);
        Assert.Equal(second.Id, body.Assets[0].Id);
        Assert.Equal(first.Id, body.Assets[1].Id);
        Assert.Equal(2048, body.PortfolioBytesUsed);
    }

    [Fact]
    public async Task Type_Filter_Image_Returns_Only_Images()
    {
        var client = Fx.CreateClientFor("uid-alice", "alice@example.com");
        await SignupAsync(client, "alice");
        var portfolio = await CreatePortfolioAsync(client, "x", "x");

        await UploadFullAsync(Fx, client, portfolio.Id, "photo.jpg", "image/jpeg", FakeJpegBytes(1024));
        await UploadFullAsync(Fx, client, portfolio.Id, "doc.pdf", "application/pdf", FakeJpegBytes(2048));

        var imageResponse = await client.GetAsync($"/api/portfolios/{portfolio.Id}/assets?type=image");
        var imageBody = await imageResponse.Content.ReadFromJsonAsync<ListAssetsResponse>();
        Assert.Single(imageBody!.Assets);
        Assert.StartsWith("image/", imageBody.Assets[0].ContentType);

        var pdfResponse = await client.GetAsync($"/api/portfolios/{portfolio.Id}/assets?type=pdf");
        var pdfBody = await pdfResponse.Content.ReadFromJsonAsync<ListAssetsResponse>();
        Assert.Single(pdfBody!.Assets);
        Assert.Equal("application/pdf", pdfBody.Assets[0].ContentType);
    }

    [Fact]
    public async Task Soft_Deleted_Hidden_From_List()
    {
        var client = Fx.CreateClientFor("uid-alice", "alice@example.com");
        await SignupAsync(client, "alice");
        var portfolio = await CreatePortfolioAsync(client, "x", "x");

        var asset = await UploadFullAsync(Fx, client, portfolio.Id, "p.jpg", "image/jpeg", FakeJpegBytes(1024));
        var del = await client.DeleteAsync($"/api/portfolios/{portfolio.Id}/assets/{asset.Id}");
        del.EnsureSuccessStatusCode();

        var response = await client.GetAsync($"/api/portfolios/{portfolio.Id}/assets");
        var body = await response.Content.ReadFromJsonAsync<ListAssetsResponse>();
        Assert.Empty(body!.Assets);
    }

    [Fact]
    public async Task Unknown_Portfolio_Returns_404()
    {
        var client = Fx.CreateClientFor("uid-alice", "alice@example.com");
        await SignupAsync(client, "alice");

        var response = await client.GetAsync("/api/portfolios/01HMISSING/assets");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Missing_Auth_Returns_401()
    {
        var response = await Fx.CreateAnonymousClient().GetAsync("/api/portfolios/any/assets");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }
}
