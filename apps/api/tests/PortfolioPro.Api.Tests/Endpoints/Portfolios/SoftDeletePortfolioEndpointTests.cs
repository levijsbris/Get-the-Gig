using System.Net;
using Google.Cloud.Firestore;
using PortfolioPro.Api.Tests.TestFixtures;
using Xunit;

namespace PortfolioPro.Api.Tests.Endpoints.Portfolios;

public sealed class SoftDeletePortfolioEndpointTests : EndpointTestBase, IClassFixture<ApiTestFixture>
{
    public SoftDeletePortfolioEndpointTests(ApiTestFixture fx) : base(fx) { }

    [Fact]
    public async Task Happy_Path_Sets_SoftDeletedAt_And_Queues_Hard_Delete()
    {
        var client = Fx.CreateClientFor("uid-alice", "alice@example.com");
        await SignupAsync(client, "alice");
        var created = await CreatePortfolioAsync(client, "Doomed", "doomed");

        var response = await client.DeleteAsync($"/api/portfolios/{created.Id}");
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);

        var doc = await Fx.Firestore.Collection("users").Document("uid-alice")
            .Collection("portfolios").Document(created.Id).GetSnapshotAsync();
        Assert.True(doc.TryGetValue("softDeletedAt", out Timestamp _));

        var queueDoc = await Fx.Firestore.Collection("deletionQueue")
            .Document($"portfolio-{created.Id}").GetSnapshotAsync();
        Assert.True(queueDoc.Exists);
        Assert.Equal("portfolio", queueDoc.GetValue<string>("kind"));
        Assert.Equal(created.Id, queueDoc.GetValue<string>("targetId"));
    }

    [Fact]
    public async Task Second_Delete_Is_Idempotent_Returns_204()
    {
        var client = Fx.CreateClientFor("uid-alice", "alice@example.com");
        await SignupAsync(client, "alice");
        var created = await CreatePortfolioAsync(client, "Doomed", "doomed");

        var first = await client.DeleteAsync($"/api/portfolios/{created.Id}");
        Assert.Equal(HttpStatusCode.NoContent, first.StatusCode);

        var second = await client.DeleteAsync($"/api/portfolios/{created.Id}");
        Assert.Equal(HttpStatusCode.NoContent, second.StatusCode);
    }

    [Fact]
    public async Task Unknown_Id_Returns_404()
    {
        var client = Fx.CreateClientFor("uid-alice", "alice@example.com");
        await SignupAsync(client, "alice");

        var response = await client.DeleteAsync("/api/portfolios/01HMISSING");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Missing_Auth_Returns_401()
    {
        var response = await Fx.CreateAnonymousClient().DeleteAsync("/api/portfolios/anything");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }
}
