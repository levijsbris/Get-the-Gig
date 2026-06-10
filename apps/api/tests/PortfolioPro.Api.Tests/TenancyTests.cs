using System.Net;
using System.Net.Http.Json;
using PortfolioPro.Api.Endpoints.Auth.Dto;
using PortfolioPro.Api.Tests.TestFixtures;
using Xunit;

namespace PortfolioPro.Api.Tests;

/// <summary>
/// Placeholder cross-tenant test. Phase 2+ endpoints (portfolios, assets, ...) must
/// extend this so we can assert no endpoint returns or mutates another user's data.
/// See add-endpoint skill § "The seven rules" / firestore-data-model skill § "The tenancy rule".
/// </summary>
public sealed class TenancyTests : EndpointTestBase, IClassFixture<ApiTestFixture>
{
    public TenancyTests(ApiTestFixture fx) : base(fx) { }

    [Fact]
    public async Task Me_Returns_Each_Users_Own_Profile_Not_The_Others()
    {
        var alice = Fx.CreateClientFor("uid-alice", "alice@example.com");
        var bob = Fx.CreateClientFor("uid-bob", "bob@example.com");
        await alice.PostAsJsonAsync("/api/auth/signup", new SignupRequest("alice"));
        await bob.PostAsJsonAsync("/api/auth/signup", new SignupRequest("bob"));

        var aliceMe = await (await alice.GetAsync("/api/auth/me")).Content.ReadFromJsonAsync<MeResponse>();
        var bobMe = await (await bob.GetAsync("/api/auth/me")).Content.ReadFromJsonAsync<MeResponse>();

        Assert.Equal("alice", aliceMe!.Username);
        Assert.Equal("uid-alice", aliceMe.Uid);
        Assert.Equal("bob", bobMe!.Username);
        Assert.Equal("uid-bob", bobMe.Uid);
    }
}
