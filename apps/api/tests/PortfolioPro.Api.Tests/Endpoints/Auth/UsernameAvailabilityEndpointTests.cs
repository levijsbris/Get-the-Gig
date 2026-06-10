using System.Net;
using System.Net.Http.Json;
using PortfolioPro.Api.Endpoints.Auth.Dto;
using PortfolioPro.Api.Tests.TestFixtures;
using Xunit;

namespace PortfolioPro.Api.Tests.Endpoints.Auth;

public sealed class UsernameAvailabilityEndpointTests : EndpointTestBase, IClassFixture<ApiTestFixture>
{
    public UsernameAvailabilityEndpointTests(ApiTestFixture fx) : base(fx) { }

    [Fact]
    public async Task Free_Username_Reports_Available()
    {
        var client = Fx.CreateAnonymousClient();
        var response = await client.GetAsync("/api/auth/username/availability?username=fresh-name");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<UsernameAvailabilityResponse>();
        Assert.NotNull(body);
        Assert.True(body!.Available);
    }

    [Fact]
    public async Task Taken_Username_Reports_Unavailable()
    {
        // Seed Alice.
        var alice = Fx.CreateClientFor("uid-alice", "alice@example.com");
        var signup = await alice.PostAsJsonAsync("/api/auth/signup", new SignupRequest("alice"));
        Assert.Equal(HttpStatusCode.Created, signup.StatusCode);

        // Anonymous check.
        var anon = Fx.CreateAnonymousClient();
        var response = await anon.GetAsync("/api/auth/username/availability?username=alice");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<UsernameAvailabilityResponse>();
        Assert.False(body!.Available);
        Assert.NotNull(body.Reason);
    }

    [Fact]
    public async Task Reserved_Username_Reports_Unavailable_With_Reason()
    {
        var client = Fx.CreateAnonymousClient();
        var response = await client.GetAsync("/api/auth/username/availability?username=admin");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<UsernameAvailabilityResponse>();
        Assert.False(body!.Available);
        Assert.Contains("reserved", body.Reason!, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Invalid_Username_Reports_Unavailable_With_Reason()
    {
        var client = Fx.CreateAnonymousClient();
        var response = await client.GetAsync("/api/auth/username/availability?username=Ab");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<UsernameAvailabilityResponse>();
        Assert.False(body!.Available);
        Assert.NotNull(body.Reason);
    }
}
