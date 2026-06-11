using System.Net;
using System.Net.Http.Json;
using PortfolioPro.Api.Endpoints.Portfolios.Dto;
using PortfolioPro.Api.Tests.TestFixtures;
using Xunit;

namespace PortfolioPro.Api.Tests.Endpoints.Portfolios;

public sealed class UpdatePortfolioEndpointTests : EndpointTestBase, IClassFixture<ApiTestFixture>
{
    public UpdatePortfolioEndpointTests(ApiTestFixture fx) : base(fx) { }

    private static StringContent JsonBody(object value) =>
        new(System.Text.Json.JsonSerializer.Serialize(value), System.Text.Encoding.UTF8, "application/json");

    [Fact]
    public async Task Happy_Path_Updates_Title_And_Bumps_UpdatedAt()
    {
        var client = Fx.CreateClientFor("uid-alice", "alice@example.com");
        await SignupAsync(client, "alice");
        var created = await CreatePortfolioAsync(client, "Old", "old");

        Fx.Clock.Advance(TimeSpan.FromMinutes(5));
        var response = await client.PatchAsync(
            $"/api/portfolios/{created.Id}",
            JsonBody(new UpdatePortfolioRequest("New Title", null, null)));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<PortfolioSummary>();
        Assert.Equal("New Title", body!.Title);
        Assert.True(body.UpdatedAt > created.UpdatedAt);
    }

    [Fact]
    public async Task Slug_Change_Moves_Slug_Index_Doc()
    {
        var client = Fx.CreateClientFor("uid-alice", "alice@example.com");
        await SignupAsync(client, "alice");
        var created = await CreatePortfolioAsync(client, "Resume", "resume");

        var response = await client.PatchAsync(
            $"/api/portfolios/{created.Id}",
            JsonBody(new UpdatePortfolioRequest(null, null, "resume-v2")));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);

        var oldSlugDoc = await Fx.Firestore.Collection("users").Document("uid-alice")
            .Collection("portfolioSlugs").Document("resume").GetSnapshotAsync();
        var newSlugDoc = await Fx.Firestore.Collection("users").Document("uid-alice")
            .Collection("portfolioSlugs").Document("resume-v2").GetSnapshotAsync();
        Assert.False(oldSlugDoc.Exists);
        Assert.True(newSlugDoc.Exists);
        Assert.Equal(created.Id, newSlugDoc.GetValue<string>("pid"));
    }

    [Fact]
    public async Task Slug_Change_To_Existing_Slug_Returns_409()
    {
        var client = Fx.CreateClientFor("uid-alice", "alice@example.com");
        await SignupAsync(client, "alice");
        var first = await CreatePortfolioAsync(client, "First", "first");
        await CreatePortfolioAsync(client, "Second", "second");

        var response = await client.PatchAsync(
            $"/api/portfolios/{first.Id}",
            JsonBody(new UpdatePortfolioRequest(null, null, "second")));
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task Empty_Body_Returns_400()
    {
        var client = Fx.CreateClientFor("uid-alice", "alice@example.com");
        await SignupAsync(client, "alice");
        var created = await CreatePortfolioAsync(client, "x", "x");

        var response = await client.PatchAsync(
            $"/api/portfolios/{created.Id}",
            JsonBody(new UpdatePortfolioRequest(null, null, null)));
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Unknown_Id_Returns_404()
    {
        var client = Fx.CreateClientFor("uid-alice", "alice@example.com");
        await SignupAsync(client, "alice");

        var response = await client.PatchAsync(
            "/api/portfolios/01HMISSING",
            JsonBody(new UpdatePortfolioRequest("title", null, null)));
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Missing_Auth_Returns_401()
    {
        var response = await Fx.CreateAnonymousClient().PatchAsync(
            "/api/portfolios/anything",
            JsonBody(new UpdatePortfolioRequest("title", null, null)));
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }
}
