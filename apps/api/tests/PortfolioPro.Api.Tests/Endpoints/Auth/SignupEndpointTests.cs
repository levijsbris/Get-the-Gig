using System.Net;
using System.Net.Http.Json;
using PortfolioPro.Api.Endpoints.Auth.Dto;
using PortfolioPro.Api.Tests.TestFixtures;
using Xunit;

namespace PortfolioPro.Api.Tests.Endpoints.Auth;

public sealed class SignupEndpointTests : EndpointTestBase, IClassFixture<ApiTestFixture>
{
    public SignupEndpointTests(ApiTestFixture fx) : base(fx) { }

    [Fact]
    public async Task Happy_Path_Creates_User_Doc_And_Claims_Username()
    {
        var client = Fx.CreateClientFor("uid-alice", "alice@example.com");

        var response = await client.PostAsJsonAsync("/api/auth/signup", new SignupRequest("alice"));

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<MeResponse>();
        Assert.NotNull(body);
        Assert.Equal("uid-alice", body!.Uid);
        Assert.Equal("alice@example.com", body.Email);
        Assert.Equal("alice", body.Username);
        Assert.True(body.HasAccount);

        var userDoc = await Fx.Firestore.Collection("users").Document("uid-alice").GetSnapshotAsync();
        Assert.True(userDoc.Exists);
        Assert.Equal("alice", userDoc.GetValue<string>("username"));
        Assert.Equal("alice@example.com", userDoc.GetValue<string>("email"));

        var usernameDoc = await Fx.Firestore.Collection("usernames").Document("alice").GetSnapshotAsync();
        Assert.True(usernameDoc.Exists);
        Assert.Equal("uid-alice", usernameDoc.GetValue<string>("uid"));
    }

    [Fact]
    public async Task Missing_Auth_Returns_401()
    {
        var client = Fx.CreateAnonymousClient();
        var response = await client.PostAsJsonAsync("/api/auth/signup", new SignupRequest("alice"));
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Invalid_Token_Returns_401()
    {
        var client = Fx.CreateClientWithToken("not.a.real.token");
        var response = await client.PostAsJsonAsync("/api/auth/signup", new SignupRequest("alice"));
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Expired_Token_Returns_401()
    {
        var client = Fx.CreateClientWithToken(Fx.Jwt.IssueExpired("uid-alice", "alice@example.com"));
        var response = await client.PostAsJsonAsync("/api/auth/signup", new SignupRequest("alice"));
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Invalid_Username_Returns_400()
    {
        var client = Fx.CreateClientFor("uid-alice", "alice@example.com");
        var response = await client.PostAsJsonAsync("/api/auth/signup", new SignupRequest("AL!CE"));
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Reserved_Username_Returns_400()
    {
        var client = Fx.CreateClientFor("uid-alice", "alice@example.com");
        var response = await client.PostAsJsonAsync("/api/auth/signup", new SignupRequest("admin"));
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Already_Taken_Username_Returns_409()
    {
        // Alice claims "shared".
        var alice = Fx.CreateClientFor("uid-alice", "alice@example.com");
        var firstResponse = await alice.PostAsJsonAsync("/api/auth/signup", new SignupRequest("shared"));
        Assert.Equal(HttpStatusCode.Created, firstResponse.StatusCode);

        // Bob tries the same.
        var bob = Fx.CreateClientFor("uid-bob", "bob@example.com");
        var secondResponse = await bob.PostAsJsonAsync("/api/auth/signup", new SignupRequest("shared"));
        Assert.Equal(HttpStatusCode.Conflict, secondResponse.StatusCode);
    }

    [Fact]
    public async Task Second_Signup_For_Same_Uid_Returns_409()
    {
        var client = Fx.CreateClientFor("uid-alice", "alice@example.com");
        var first = await client.PostAsJsonAsync("/api/auth/signup", new SignupRequest("alice"));
        Assert.Equal(HttpStatusCode.Created, first.StatusCode);

        var second = await client.PostAsJsonAsync("/api/auth/signup", new SignupRequest("alice2"));
        Assert.Equal(HttpStatusCode.Conflict, second.StatusCode);
    }
}
