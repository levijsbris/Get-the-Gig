using System.Net;
using System.Net.Http.Json;
using PortfolioPro.Api.Endpoints.Portfolios.Dto;
using PortfolioPro.Api.Tests.TestFixtures;
using Xunit;

namespace PortfolioPro.Api.Tests.Endpoints.Portfolios;

public sealed class GetPortfolioEndpointTests : EndpointTestBase, IClassFixture<ApiTestFixture>
{
    public GetPortfolioEndpointTests(ApiTestFixture fx) : base(fx) { }

    [Fact]
    public async Task Happy_Path_Returns_Portfolio()
    {
        var client = Fx.CreateClientFor("uid-alice", "alice@example.com");
        await SignupAsync(client, "alice");
        var created = await CreatePortfolioAsync(client, "Resume", "resume");

        var response = await client.GetAsync($"/api/portfolios/{created.Id}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<PortfolioSummary>();
        Assert.NotNull(body);
        Assert.Equal(created.Id, body!.Id);
        Assert.Equal("Resume", body.Title);
    }

    [Fact]
    public async Task Unknown_Id_Returns_404()
    {
        var client = Fx.CreateClientFor("uid-alice", "alice@example.com");
        await SignupAsync(client, "alice");

        var response = await client.GetAsync("/api/portfolios/01HSOMETHINGTHATDOESNTEXIST");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Missing_Auth_Returns_401()
    {
        var response = await Fx.CreateAnonymousClient().GetAsync("/api/portfolios/anything");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }
}
