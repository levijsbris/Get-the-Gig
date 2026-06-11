using System.Net;
using System.Net.Http.Json;
using PortfolioPro.Api.Endpoints.Portfolios.Dto;
using PortfolioPro.Api.Tests.TestFixtures;
using Xunit;

namespace PortfolioPro.Api.Tests.Endpoints.Portfolios;

public sealed class ListPortfoliosEndpointTests : EndpointTestBase, IClassFixture<ApiTestFixture>
{
    public ListPortfoliosEndpointTests(ApiTestFixture fx) : base(fx) { }

    [Fact]
    public async Task Empty_List_When_No_Portfolios()
    {
        var client = Fx.CreateClientFor("uid-alice", "alice@example.com");
        await SignupAsync(client, "alice");

        var response = await client.GetAsync("/api/portfolios");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<ListPortfoliosResponse>();
        Assert.NotNull(body);
        Assert.Empty(body!.Portfolios);
    }

    [Fact]
    public async Task Returns_Portfolios_Ordered_By_UpdatedAt_Desc()
    {
        var client = Fx.CreateClientFor("uid-alice", "alice@example.com");
        await SignupAsync(client, "alice");

        // Three portfolios created at distinct timestamps via the fake clock so the
        // ordering assertion isn't dependent on Firestore's tiebreak behaviour.
        await CreatePortfolioAsync(client, "Oldest", "oldest");
        Fx.Clock.Advance(TimeSpan.FromMinutes(5));
        await CreatePortfolioAsync(client, "Middle", "middle");
        Fx.Clock.Advance(TimeSpan.FromMinutes(5));
        await CreatePortfolioAsync(client, "Newest", "newest");

        var response = await client.GetAsync("/api/portfolios");
        var body = await response.Content.ReadFromJsonAsync<ListPortfoliosResponse>();

        Assert.NotNull(body);
        Assert.Equal(3, body!.Portfolios.Count);
        Assert.Equal("newest", body.Portfolios[0].Slug);
        Assert.Equal("middle", body.Portfolios[1].Slug);
        Assert.Equal("oldest", body.Portfolios[2].Slug);
    }

    [Fact]
    public async Task Soft_Deleted_Hidden_By_Default_And_Shown_With_Include_Flag()
    {
        var client = Fx.CreateClientFor("uid-alice", "alice@example.com");
        await SignupAsync(client, "alice");

        var alive = await CreatePortfolioAsync(client, "Alive", "alive");
        Fx.Clock.Advance(TimeSpan.FromMinutes(1));
        var doomed = await CreatePortfolioAsync(client, "Doomed", "doomed");
        Fx.Clock.Advance(TimeSpan.FromMinutes(1));
        var del = await client.DeleteAsync($"/api/portfolios/{doomed.Id}");
        del.EnsureSuccessStatusCode();

        var defaultResponse = await client.GetAsync("/api/portfolios");
        var defaultBody = await defaultResponse.Content.ReadFromJsonAsync<ListPortfoliosResponse>();
        Assert.NotNull(defaultBody);
        Assert.Single(defaultBody!.Portfolios);
        Assert.Equal(alive.Id, defaultBody.Portfolios[0].Id);

        var includedResponse = await client.GetAsync("/api/portfolios?includeDeleted=true");
        var includedBody = await includedResponse.Content.ReadFromJsonAsync<ListPortfoliosResponse>();
        Assert.NotNull(includedBody);
        Assert.Equal(2, includedBody!.Portfolios.Count);
        // The soft-deleted one was the most recent write (delete bumps updatedAt) so
        // it leads when included.
        Assert.Equal(doomed.Id, includedBody.Portfolios[0].Id);
        Assert.NotNull(includedBody.Portfolios[0].SoftDeletedAt);
    }

    [Fact]
    public async Task Missing_Auth_Returns_401()
    {
        var response = await Fx.CreateAnonymousClient().GetAsync("/api/portfolios");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }
}
