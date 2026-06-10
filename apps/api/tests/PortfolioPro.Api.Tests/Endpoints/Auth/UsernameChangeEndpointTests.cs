using System.Net;
using System.Net.Http.Json;
using PortfolioPro.Api.Endpoints.Auth.Dto;
using PortfolioPro.Api.Tests.TestFixtures;
using Xunit;

namespace PortfolioPro.Api.Tests.Endpoints.Auth;

public sealed class UsernameChangeEndpointTests : EndpointTestBase, IClassFixture<ApiTestFixture>
{
    public UsernameChangeEndpointTests(ApiTestFixture fx) : base(fx) { }

    [Fact]
    public async Task Happy_Path_Releases_Old_And_Claims_New()
    {
        var client = Fx.CreateClientFor("uid-alice", "alice@example.com");
        await client.PostAsJsonAsync("/api/auth/signup", new SignupRequest("alice"));

        var response = await client.PostAsJsonAsync("/api/auth/username", new ChangeUsernameRequest("alicia"));
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);

        var oldDoc = await Fx.Firestore.Collection("usernames").Document("alice").GetSnapshotAsync();
        Assert.False(oldDoc.Exists);
        var newDoc = await Fx.Firestore.Collection("usernames").Document("alicia").GetSnapshotAsync();
        Assert.True(newDoc.Exists);
        Assert.Equal("uid-alice", newDoc.GetValue<string>("uid"));

        var userDoc = await Fx.Firestore.Collection("users").Document("uid-alice").GetSnapshotAsync();
        Assert.Equal("alicia", userDoc.GetValue<string>("username"));
    }

    [Fact]
    public async Task Missing_Auth_Returns_401()
    {
        var client = Fx.CreateAnonymousClient();
        var response = await client.PostAsJsonAsync("/api/auth/username", new ChangeUsernameRequest("anything"));
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Invalid_New_Username_Returns_400()
    {
        var client = Fx.CreateClientFor("uid-alice", "alice@example.com");
        await client.PostAsJsonAsync("/api/auth/signup", new SignupRequest("alice"));

        var response = await client.PostAsJsonAsync("/api/auth/username", new ChangeUsernameRequest("BAD!"));
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task New_Username_Already_Taken_Returns_409()
    {
        var alice = Fx.CreateClientFor("uid-alice", "alice@example.com");
        var bob = Fx.CreateClientFor("uid-bob", "bob@example.com");
        await alice.PostAsJsonAsync("/api/auth/signup", new SignupRequest("alice"));
        await bob.PostAsJsonAsync("/api/auth/signup", new SignupRequest("bob"));

        var response = await alice.PostAsJsonAsync("/api/auth/username", new ChangeUsernameRequest("bob"));
        Assert.Equal(HttpStatusCode.Conflict, response.StatusCode);
    }

    [Fact]
    public async Task User_Without_Account_Returns_404()
    {
        // No signup → user.Username is null on the server side.
        var client = Fx.CreateClientFor("uid-fresh", "fresh@example.com");
        var response = await client.PostAsJsonAsync("/api/auth/username", new ChangeUsernameRequest("name"));
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}
