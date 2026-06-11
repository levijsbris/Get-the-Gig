using System.Net;
using System.Net.Http.Json;
using PortfolioPro.Api.Endpoints.Portfolios.Assets.Dto;
using PortfolioPro.Api.Services;
using PortfolioPro.Api.Tests.TestFixtures;
using Xunit;

namespace PortfolioPro.Api.Tests.Endpoints.Portfolios.Assets;

public sealed class RequestUploadUrlEndpointTests : EndpointTestBase, IClassFixture<ApiTestFixture>
{
    public RequestUploadUrlEndpointTests(ApiTestFixture fx) : base(fx) { }

    [Fact]
    public async Task Happy_Path_Returns_201_With_Signed_Url_And_AssetId()
    {
        var client = Fx.CreateClientFor("uid-alice", "alice@example.com");
        await SignupAsync(client, "alice");
        var portfolio = await CreatePortfolioAsync(client, "Resume", "resume");

        var response = await client.PostAsJsonAsync(
            $"/api/portfolios/{portfolio.Id}/assets/upload-url",
            new RequestUploadUrlRequest("photo.jpg", "image/jpeg", 100_000, 800, 600));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<UploadUrlResponse>();
        Assert.NotNull(body);
        Assert.NotEmpty(body!.AssetId);
        Assert.StartsWith(Fx.FakeGcsBaseUrl.TrimEnd('/'), body.UploadUrl, StringComparison.Ordinal);
        // The key is URL-encoded in the upload URL; decode the query string before
        // comparing so the assertion isn't tied to the emulator's encoding choices.
        var name = System.Web.HttpUtility.ParseQueryString(new Uri(body.UploadUrl).Query)["name"];
        Assert.Equal($"users/uid-alice/assets/{body.AssetId}/photo.jpg", name);
        Assert.Equal("POST", body.UploadMethod);
        Assert.Equal(100_000, body.PortfolioBytesAfterUpload);
        Assert.False(body.WarnPortfolioQuota);
    }

    [Fact]
    public async Task Disallowed_Content_Type_Returns_400()
    {
        var client = Fx.CreateClientFor("uid-alice", "alice@example.com");
        await SignupAsync(client, "alice");
        var portfolio = await CreatePortfolioAsync(client, "x", "x");

        var response = await client.PostAsJsonAsync(
            $"/api/portfolios/{portfolio.Id}/assets/upload-url",
            new RequestUploadUrlRequest("evil.exe", "application/octet-stream", 1000, null, null));
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Oversize_Image_Returns_400()
    {
        var client = Fx.CreateClientFor("uid-alice", "alice@example.com");
        await SignupAsync(client, "alice");
        var portfolio = await CreatePortfolioAsync(client, "x", "x");

        var response = await client.PostAsJsonAsync(
            $"/api/portfolios/{portfolio.Id}/assets/upload-url",
            new RequestUploadUrlRequest("big.jpg", "image/jpeg", AssetLimits.MaxImageBytes + 1, null, null));
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Pdf_Up_To_25MB_Is_Accepted()
    {
        var client = Fx.CreateClientFor("uid-alice", "alice@example.com");
        await SignupAsync(client, "alice");
        var portfolio = await CreatePortfolioAsync(client, "x", "x");

        var response = await client.PostAsJsonAsync(
            $"/api/portfolios/{portfolio.Id}/assets/upload-url",
            new RequestUploadUrlRequest("resume.pdf", "application/pdf", AssetLimits.MaxPdfBytes, null, null));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    [Fact]
    public async Task Quota_Would_Be_Exceeded_Returns_409()
    {
        var client = Fx.CreateClientFor("uid-alice", "alice@example.com");
        await SignupAsync(client, "alice");
        var portfolio = await CreatePortfolioAsync(client, "x", "x");

        // Seed storageBytesPortfolio to just under the cap so a single image push wins.
        await Fx.Firestore.Collection("users").Document("uid-alice")
            .Collection("portfolios").Document(portfolio.Id)
            .UpdateAsync("storageBytesPortfolio", AssetLimits.PortfolioHardCapBytes - 1000);

        var response = await client.PostAsJsonAsync(
            $"/api/portfolios/{portfolio.Id}/assets/upload-url",
            new RequestUploadUrlRequest("photo.jpg", "image/jpeg", 5000, null, null));
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        var problem = await response.Content.ReadAsStringAsync();
        Assert.Contains("quota-exceeded", problem);
    }

    [Fact]
    public async Task Warning_Flag_Set_When_Above_500MB_But_Below_600MB()
    {
        var client = Fx.CreateClientFor("uid-alice", "alice@example.com");
        await SignupAsync(client, "alice");
        var portfolio = await CreatePortfolioAsync(client, "x", "x");

        await Fx.Firestore.Collection("users").Document("uid-alice")
            .Collection("portfolios").Document(portfolio.Id)
            .UpdateAsync("storageBytesPortfolio", AssetLimits.PortfolioWarnBytes - 1000);

        var response = await client.PostAsJsonAsync(
            $"/api/portfolios/{portfolio.Id}/assets/upload-url",
            new RequestUploadUrlRequest("photo.jpg", "image/jpeg", 5000, null, null));
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<UploadUrlResponse>();
        Assert.True(body!.WarnPortfolioQuota);
    }

    [Fact]
    public async Task Unknown_Portfolio_Returns_404()
    {
        var client = Fx.CreateClientFor("uid-alice", "alice@example.com");
        await SignupAsync(client, "alice");

        var response = await client.PostAsJsonAsync(
            "/api/portfolios/01HMISSING/assets/upload-url",
            new RequestUploadUrlRequest("photo.jpg", "image/jpeg", 1000, null, null));
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Soft_Deleted_Portfolio_Returns_404()
    {
        var client = Fx.CreateClientFor("uid-alice", "alice@example.com");
        await SignupAsync(client, "alice");
        var portfolio = await CreatePortfolioAsync(client, "x", "x");
        var del = await client.DeleteAsync($"/api/portfolios/{portfolio.Id}");
        del.EnsureSuccessStatusCode();

        var response = await client.PostAsJsonAsync(
            $"/api/portfolios/{portfolio.Id}/assets/upload-url",
            new RequestUploadUrlRequest("photo.jpg", "image/jpeg", 1000, null, null));
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Missing_Auth_Returns_401()
    {
        var response = await Fx.CreateAnonymousClient().PostAsJsonAsync(
            "/api/portfolios/any/assets/upload-url",
            new RequestUploadUrlRequest("photo.jpg", "image/jpeg", 1000, null, null));
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Unsafe_Filename_Returns_400()
    {
        var client = Fx.CreateClientFor("uid-alice", "alice@example.com");
        await SignupAsync(client, "alice");
        var portfolio = await CreatePortfolioAsync(client, "x", "x");

        var response = await client.PostAsJsonAsync(
            $"/api/portfolios/{portfolio.Id}/assets/upload-url",
            new RequestUploadUrlRequest("../escape.jpg", "image/jpeg", 1000, null, null));
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }
}
