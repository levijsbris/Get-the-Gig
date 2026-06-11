using System.Net;
using System.Net.Http.Json;
using PortfolioPro.Api.Endpoints.Auth.Dto;
using PortfolioPro.Api.Endpoints.Portfolios.Assets.Dto;
using PortfolioPro.Api.Endpoints.Portfolios.Dto;
using PortfolioPro.Api.Tests.TestFixtures;
using Xunit;
using static PortfolioPro.Api.Tests.TestFixtures.AssetTestHelpers;

namespace PortfolioPro.Api.Tests;

/// <summary>
/// Cross-tenant smoke tests. Every new endpoint that touches user-owned data must add
/// a case here so we can assert no endpoint returns or mutates another user's data.
/// See add-endpoint skill § "The seven rules" / firestore-data-model skill § "The tenancy rule".
/// </summary>
public sealed class TenancyTests : EndpointTestBase, IClassFixture<ApiTestFixture>
{
    public TenancyTests(ApiTestFixture fx) : base(fx) { }

    private static StringContent JsonBody(object value) =>
        new(System.Text.Json.JsonSerializer.Serialize(value), System.Text.Encoding.UTF8, "application/json");

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

    [Fact]
    public async Task Bob_Cannot_See_Alices_Portfolios_Or_Touch_Them()
    {
        var alice = Fx.CreateClientFor("uid-alice", "alice@example.com");
        var bob = Fx.CreateClientFor("uid-bob", "bob@example.com");
        await SignupAsync(alice, "alice");
        await SignupAsync(bob, "bob");

        var aliceResume = await CreatePortfolioAsync(alice, "Alice Resume", "resume");

        // Bob's list is empty.
        var bobList = await bob.GetAsync("/api/portfolios");
        var bobListBody = await bobList.Content.ReadFromJsonAsync<ListPortfoliosResponse>();
        Assert.Empty(bobListBody!.Portfolios);

        // Bob's GET by Alice's id returns 404 (NOT 403, to avoid leaking existence).
        var bobGet = await bob.GetAsync($"/api/portfolios/{aliceResume.Id}");
        Assert.Equal(HttpStatusCode.NotFound, bobGet.StatusCode);

        // Bob's PATCH by Alice's id returns 404.
        var bobPatch = await bob.PatchAsync(
            $"/api/portfolios/{aliceResume.Id}",
            JsonBody(new UpdatePortfolioRequest("hijack", null, null)));
        Assert.Equal(HttpStatusCode.NotFound, bobPatch.StatusCode);

        // Bob's DELETE by Alice's id returns 404.
        var bobDelete = await bob.DeleteAsync($"/api/portfolios/{aliceResume.Id}");
        Assert.Equal(HttpStatusCode.NotFound, bobDelete.StatusCode);

        // Bob's restore by Alice's id returns 404.
        var bobRestore = await bob.PostAsync($"/api/portfolios/{aliceResume.Id}/restore", content: null);
        Assert.Equal(HttpStatusCode.NotFound, bobRestore.StatusCode);

        // Alice's portfolio is untouched.
        var aliceCheck = await alice.GetAsync($"/api/portfolios/{aliceResume.Id}");
        var aliceCheckBody = await aliceCheck.Content.ReadFromJsonAsync<PortfolioSummary>();
        Assert.Equal("Alice Resume", aliceCheckBody!.Title);
        Assert.Null(aliceCheckBody.SoftDeletedAt);
    }

    [Fact]
    public async Task Bob_Cannot_See_Upload_Or_Delete_Alices_Assets()
    {
        var alice = Fx.CreateClientFor("uid-alice", "alice@example.com");
        var bob = Fx.CreateClientFor("uid-bob", "bob@example.com");
        await SignupAsync(alice, "alice");
        await SignupAsync(bob, "bob");

        var aliceResume = await CreatePortfolioAsync(alice, "Alice Resume", "resume");
        var aliceAsset = await UploadFullAsync(
            Fx, alice, aliceResume.Id, "headshot.jpg", "image/jpeg", FakeJpegBytes(2048));

        // Bob's list against Alice's portfolio is a 404 (the portfolio isn't his).
        var bobList = await bob.GetAsync($"/api/portfolios/{aliceResume.Id}/assets");
        Assert.Equal(HttpStatusCode.NotFound, bobList.StatusCode);

        // Bob's upload-url against Alice's portfolio is a 404.
        var bobUpload = await bob.PostAsJsonAsync(
            $"/api/portfolios/{aliceResume.Id}/assets/upload-url",
            new RequestUploadUrlRequest("p.jpg", "image/jpeg", 1024, null, null));
        Assert.Equal(HttpStatusCode.NotFound, bobUpload.StatusCode);

        // Bob's delete against Alice's asset is a 404.
        var bobDelete = await bob.DeleteAsync(
            $"/api/portfolios/{aliceResume.Id}/assets/{aliceAsset.Id}");
        Assert.Equal(HttpStatusCode.NotFound, bobDelete.StatusCode);

        // Alice's asset is untouched.
        var aliceList = await alice.GetAsync($"/api/portfolios/{aliceResume.Id}/assets");
        var aliceListBody = await aliceList.Content.ReadFromJsonAsync<ListAssetsResponse>();
        Assert.Single(aliceListBody!.Assets);
        Assert.Equal(aliceAsset.Id, aliceListBody.Assets[0].Id);

        // Soft-delete then attempt cross-tenant restore.
        var aliceDelete = await alice.DeleteAsync(
            $"/api/portfolios/{aliceResume.Id}/assets/{aliceAsset.Id}");
        aliceDelete.EnsureSuccessStatusCode();

        var bobRestore = await bob.PostAsync(
            $"/api/portfolios/{aliceResume.Id}/assets/{aliceAsset.Id}/restore", content: null);
        Assert.Equal(HttpStatusCode.NotFound, bobRestore.StatusCode);
    }

    [Fact]
    public async Task Bob_Cannot_Patch_Alices_Draft()
    {
        var alice = Fx.CreateClientFor("uid-alice", "alice@example.com");
        var bob = Fx.CreateClientFor("uid-bob", "bob@example.com");
        await SignupAsync(alice, "alice");
        await SignupAsync(bob, "bob");

        var aliceResume = await CreatePortfolioAsync(alice, "Alice Resume", "resume");

        var validSnapshot = System.Text.Json.JsonDocument.Parse("""
            {
              "version": 1,
              "portfolio": { "title": "Hijack", "description": "" },
              "theme": {
                "fonts": { "heading": "Inter", "body": "Inter" },
                "colors": {
                  "background": "#fff", "surface": "#fff", "foreground": "#000",
                  "muted": "#888", "primary": "#000", "accent": "#0af"
                },
                "spacing": { "xs": 4, "sm": 8, "md": 16, "lg": 32, "xl": 64 },
                "radii": { "sm": 4, "md": 8, "lg": 16 }
              },
              "globalSections": { "header": null, "footer": null },
              "pages": [{ "id": "p", "slug": "home", "title": "Home", "sections": [] }]
            }
        """).RootElement;

        var response = await bob.PatchAsJsonAsync(
            $"/api/portfolios/{aliceResume.Id}/draft",
            new PortfolioPro.Api.Endpoints.Portfolios.Drafts.Dto.UpdateDraftRequest(validSnapshot, 1));
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);

        // Alice's portfolio draft is unchanged from its empty-default state.
        var portfolioDoc = await Fx.Firestore.Collection("users").Document("uid-alice")
            .Collection("portfolios").Document(aliceResume.Id).GetSnapshotAsync();
        var draft = portfolioDoc.GetValue<Dictionary<string, object>>("draft");
        var portfolioMeta = (Dictionary<string, object>)draft["portfolio"];
        Assert.NotEqual("Hijack", portfolioMeta["title"]);
    }
}
