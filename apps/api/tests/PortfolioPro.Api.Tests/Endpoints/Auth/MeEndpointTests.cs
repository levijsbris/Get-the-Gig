using System.Net;
using System.Net.Http.Json;
using PortfolioPro.Api.Endpoints.Auth.Dto;
using PortfolioPro.Api.Tests.TestFixtures;
using Xunit;

namespace PortfolioPro.Api.Tests.Endpoints.Auth;

public sealed class MeEndpointTests : EndpointTestBase, IClassFixture<ApiTestFixture>
{
    public MeEndpointTests(ApiTestFixture fx) : base(fx) { }

    [Fact]
    public async Task Returns_HasAccount_False_When_User_Doc_Missing()
    {
        var client = Fx.CreateClientFor("uid-new", "new@example.com");
        var response = await client.GetAsync("/api/auth/me");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<MeResponse>();
        Assert.NotNull(body);
        Assert.Equal("uid-new", body!.Uid);
        Assert.Equal("new@example.com", body.Email);
        Assert.Null(body.Username);
        Assert.False(body.HasAccount);
    }

    [Fact]
    public async Task Returns_HasAccount_True_After_Signup()
    {
        var client = Fx.CreateClientFor("uid-alice", "alice@example.com");
        var signup = await client.PostAsJsonAsync("/api/auth/signup", new SignupRequest("alice"));
        Assert.Equal(HttpStatusCode.Created, signup.StatusCode);

        var me = await client.GetAsync("/api/auth/me");
        Assert.Equal(HttpStatusCode.OK, me.StatusCode);
        var body = await me.Content.ReadFromJsonAsync<MeResponse>();
        Assert.NotNull(body);
        Assert.Equal("alice", body!.Username);
        Assert.True(body.HasAccount);
    }

    [Fact]
    public async Task Missing_Auth_Returns_401()
    {
        var client = Fx.CreateAnonymousClient();
        var response = await client.GetAsync("/api/auth/me");
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }
}
