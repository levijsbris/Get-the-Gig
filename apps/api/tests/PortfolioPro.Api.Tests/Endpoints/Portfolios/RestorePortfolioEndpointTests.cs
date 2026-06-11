using System.Net;
using System.Net.Http.Json;
using PortfolioPro.Api.Endpoints.Portfolios.Dto;
using PortfolioPro.Api.Tests.TestFixtures;
using Xunit;

namespace PortfolioPro.Api.Tests.Endpoints.Portfolios;

public sealed class RestorePortfolioEndpointTests : EndpointTestBase, IClassFixture<ApiTestFixture>
{
    public RestorePortfolioEndpointTests(ApiTestFixture fx) : base(fx) { }

    [Fact]
    public async Task Restore_Within_Grace_Clears_SoftDeletedAt_And_Removes_Queue_Entry()
    {
        var client = Fx.CreateClientFor("uid-alice", "alice@example.com");
        await SignupAsync(client, "alice");
        var created = await CreatePortfolioAsync(client, "Resume", "resume");
        var del = await client.DeleteAsync($"/api/portfolios/{created.Id}");
        del.EnsureSuccessStatusCode();

        Fx.Clock.Advance(TimeSpan.FromDays(3));

        var response = await client.PostAsync($"/api/portfolios/{created.Id}/restore", content: null);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<PortfolioSummary>();
        Assert.NotNull(body);
        Assert.Null(body!.SoftDeletedAt);
        // Restore bumps updatedAt so the restored portfolio surfaces at the top of
        // the home list.
        Assert.True(body.UpdatedAt > created.UpdatedAt);

        var queueDoc = await Fx.Firestore.Collection("deletionQueue")
            .Document($"portfolio-{created.Id}").GetSnapshotAsync();
        Assert.False(queueDoc.Exists);
    }

    [Fact]
    public async Task Restore_Past_7_Day_Grace_Returns_409_GracePeriodExpired()
    {
        var client = Fx.CreateClientFor("uid-alice", "alice@example.com");
        await SignupAsync(client, "alice");
        var created = await CreatePortfolioAsync(client, "Resume", "resume");
        var del = await client.DeleteAsync($"/api/portfolios/{created.Id}");
        del.EnsureSuccessStatusCode();

        // Cross the 7-day boundary deterministically via the fake clock.
        Fx.Clock.Advance(TimeSpan.FromDays(8));

        var response = await client.PostAsync($"/api/portfolios/{created.Id}/restore", content: null);
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        var problem = await response.Content.ReadAsStringAsync();
        Assert.Contains("grace-period-expired", problem);
    }

    [Fact]
    public async Task Restore_Of_Live_Portfolio_Returns_409_NotSoftDeleted()
    {
        var client = Fx.CreateClientFor("uid-alice", "alice@example.com");
        await SignupAsync(client, "alice");
        var created = await CreatePortfolioAsync(client, "Live", "live");

        var response = await client.PostAsync($"/api/portfolios/{created.Id}/restore", content: null);
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
        var problem = await response.Content.ReadAsStringAsync();
        Assert.Contains("not-soft-deleted", problem);
    }

    [Fact]
    public async Task Restore_Unknown_Id_Returns_404()
    {
        var client = Fx.CreateClientFor("uid-alice", "alice@example.com");
        await SignupAsync(client, "alice");

        var response = await client.PostAsync("/api/portfolios/01HMISSING/restore", content: null);
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Restore_Missing_Auth_Returns_401()
    {
        var response = await Fx.CreateAnonymousClient().PostAsync("/api/portfolios/anything/restore", content: null);
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }
}
