using System.Net;
using System.Net.Http.Json;
using PortfolioPro.Api.Tests.TestFixtures;
using Xunit;

namespace PortfolioPro.Api.Tests;

public sealed class HealthEndpointTests : IClassFixture<ApiTestFixture>
{
    private readonly ApiTestFixture _fx;

    public HealthEndpointTests(ApiTestFixture fx) => _fx = fx;

    [Fact]
    public async Task Get_Health_Returns_Ok_Status()
    {
        var client = _fx.CreateAnonymousClient();

        var response = await client.GetAsync("/api/health");
        var body = await response.Content.ReadFromJsonAsync<HealthBody>();

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.NotNull(body);
        Assert.Equal("ok", body!.Status);
    }

    private sealed record HealthBody(string Status);
}
