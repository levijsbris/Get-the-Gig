using System.Net.Http.Json;
using PortfolioPro.Api.Endpoints.Auth.Dto;
using PortfolioPro.Api.Endpoints.Portfolios.Dto;
using Xunit;

namespace PortfolioPro.Api.Tests.TestFixtures;

public abstract class EndpointTestBase : IAsyncLifetime
{
    protected EndpointTestBase(ApiTestFixture fx)
    {
        Fx = fx;
    }

    protected ApiTestFixture Fx { get; }

    public Task InitializeAsync()
    {
        // Reset the fake clock to its default so a previous test that advanced it
        // doesn't leak state into the next one (the fixture is class-scoped via
        // IClassFixture, so the FakeClock instance is shared across tests in this class).
        Fx.Clock.UtcNow = new DateTimeOffset(2026, 1, 1, 12, 0, 0, TimeSpan.Zero);
        return Fx.ResetFirestoreAsync();
    }

    public Task DisposeAsync() => Task.CompletedTask;

    protected static async Task SignupAsync(HttpClient client, string username)
    {
        var response = await client.PostAsJsonAsync("/api/auth/signup", new SignupRequest(username));
        response.EnsureSuccessStatusCode();
    }

    protected static async Task<PortfolioSummary> CreatePortfolioAsync(
        HttpClient client, string title, string slug, string? description = null)
    {
        var response = await client.PostAsJsonAsync(
            "/api/portfolios",
            new CreatePortfolioRequest(title, slug, description));
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<PortfolioSummary>())!;
    }
}
