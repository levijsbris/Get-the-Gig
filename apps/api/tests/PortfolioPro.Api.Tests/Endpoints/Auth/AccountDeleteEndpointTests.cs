using System.Net;
using System.Net.Http.Json;
using Google.Cloud.Firestore;
using PortfolioPro.Api.Endpoints.Auth.Dto;
using PortfolioPro.Api.Tests.TestFixtures;
using Xunit;

namespace PortfolioPro.Api.Tests.Endpoints.Auth;

public sealed class AccountDeleteEndpointTests : EndpointTestBase, IClassFixture<ApiTestFixture>
{
    public AccountDeleteEndpointTests(ApiTestFixture fx) : base(fx) { }

    [Fact]
    public async Task Happy_Path_Soft_Deletes_User_And_Queues_Hard_Delete()
    {
        var client = Fx.CreateClientFor("uid-alice", "alice@example.com");
        await client.PostAsJsonAsync("/api/auth/signup", new SignupRequest("alice"));

        var response = await client.DeleteAsync("/api/auth/account");
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);

        var userDoc = await Fx.Firestore.Collection("users").Document("uid-alice").GetSnapshotAsync();
        Assert.True(userDoc.Exists);
        Assert.True(userDoc.TryGetValue("softDeletedAt", out Timestamp _),
            "softDeletedAt should be set after account delete");

        var queue = await Fx.Firestore.Collection("deletionQueue")
            .WhereEqualTo("targetUid", "uid-alice")
            .GetSnapshotAsync();
        Assert.Single(queue.Documents);
        Assert.Equal("user", queue.Documents[0].GetValue<string>("kind"));
    }

    [Fact]
    public async Task Missing_Auth_Returns_401()
    {
        var client = Fx.CreateAnonymousClient();
        var response = await client.DeleteAsync("/api/auth/account");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task User_Without_Account_Returns_404()
    {
        var client = Fx.CreateClientFor("uid-ghost", "ghost@example.com");
        var response = await client.DeleteAsync("/api/auth/account");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}
