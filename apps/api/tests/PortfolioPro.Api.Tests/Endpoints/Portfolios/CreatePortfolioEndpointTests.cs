using System.Net;
using System.Net.Http.Json;
using PortfolioPro.Api.Endpoints.Portfolios.Dto;
using PortfolioPro.Api.Tests.TestFixtures;
using Xunit;

namespace PortfolioPro.Api.Tests.Endpoints.Portfolios;

public sealed class CreatePortfolioEndpointTests : EndpointTestBase, IClassFixture<ApiTestFixture>
{
    public CreatePortfolioEndpointTests(ApiTestFixture fx) : base(fx) { }

    [Fact]
    public async Task Happy_Path_Returns_201_With_Summary_And_Persists_Doc()
    {
        var client = Fx.CreateClientFor("uid-alice", "alice@example.com");
        await SignupAsync(client, "alice");

        var response = await client.PostAsJsonAsync(
            "/api/portfolios",
            new CreatePortfolioRequest("My Resume", "resume", "Senior backend engineer"));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var summary = await response.Content.ReadFromJsonAsync<PortfolioSummary>();
        Assert.NotNull(summary);
        Assert.Equal("My Resume", summary!.Title);
        Assert.Equal("resume", summary.Slug);
        Assert.Equal("Senior backend engineer", summary.Description);
        Assert.False(summary.IsPublished);
        Assert.Null(summary.SoftDeletedAt);

        var doc = await Fx.Firestore.Collection("users").Document("uid-alice")
            .Collection("portfolios").Document(summary.Id).GetSnapshotAsync();
        Assert.True(doc.Exists);
        Assert.Equal("resume", doc.GetValue<string>("slug"));

        var slugDoc = await Fx.Firestore.Collection("users").Document("uid-alice")
            .Collection("portfolioSlugs").Document("resume").GetSnapshotAsync();
        Assert.True(slugDoc.Exists);
        Assert.Equal(summary.Id, slugDoc.GetValue<string>("pid"));

        // Draft was seeded from the empty default with a fresh ULID for the home page.
        var draftPages = doc.GetValue<List<object>>("draft.pages");
        Assert.Single(draftPages);
    }

    [Fact]
    public async Task Missing_Auth_Returns_401()
    {
        var anon = Fx.CreateAnonymousClient();
        var response = await anon.PostAsJsonAsync(
            "/api/portfolios", new CreatePortfolioRequest("title", "slug", null));
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Invalid_Slug_Returns_400()
    {
        var client = Fx.CreateClientFor("uid-alice", "alice@example.com");
        await SignupAsync(client, "alice");

        var response = await client.PostAsJsonAsync(
            "/api/portfolios", new CreatePortfolioRequest("Title", "BAD SLUG!", null));
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Empty_Title_Returns_400()
    {
        var client = Fx.CreateClientFor("uid-alice", "alice@example.com");
        await SignupAsync(client, "alice");

        var response = await client.PostAsJsonAsync(
            "/api/portfolios", new CreatePortfolioRequest("", "ok-slug", null));
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Slug_Conflict_For_Same_User_Returns_409()
    {
        var client = Fx.CreateClientFor("uid-alice", "alice@example.com");
        await SignupAsync(client, "alice");
        await CreatePortfolioAsync(client, "First", "shared");

        var response = await client.PostAsJsonAsync(
            "/api/portfolios", new CreatePortfolioRequest("Second", "shared", null));
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task Different_Users_Can_Reuse_Same_Slug()
    {
        var alice = Fx.CreateClientFor("uid-alice", "alice@example.com");
        var bob = Fx.CreateClientFor("uid-bob", "bob@example.com");
        await SignupAsync(alice, "alice");
        await SignupAsync(bob, "bob");

        await CreatePortfolioAsync(alice, "Alice Resume", "resume");

        var bobResponse = await bob.PostAsJsonAsync(
            "/api/portfolios", new CreatePortfolioRequest("Bob Resume", "resume", null));
        Assert.Equal(HttpStatusCode.Created, bobResponse.StatusCode);
    }
}
