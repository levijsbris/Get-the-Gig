using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using PortfolioPro.Api.Endpoints.Portfolios.Drafts.Dto;
using PortfolioPro.Api.Services;
using PortfolioPro.Api.Tests.TestFixtures;
using Xunit;

namespace PortfolioPro.Api.Tests.Endpoints.Portfolios.Drafts;

public sealed class UpdateDraftEndpointTests : EndpointTestBase, IClassFixture<ApiTestFixture>
{
    public UpdateDraftEndpointTests(ApiTestFixture fx) : base(fx) { }

    private static JsonElement Json(string raw) => JsonDocument.Parse(raw).RootElement;

    private static JsonElement ValidEmptySnapshot() => Json("""
        {
          "version": 1,
          "portfolio": { "title": "Demo", "description": "" },
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
          "pages": [{
            "id": "01HPAGE", "slug": "home", "title": "Home", "sections": []
          }]
        }
    """);

    [Fact]
    public async Task Happy_Path_Persists_Draft_And_Bumps_DraftUpdatedAt()
    {
        var client = Fx.CreateClientFor("uid-alice", "alice@example.com");
        await SignupAsync(client, "alice");
        var portfolio = await CreatePortfolioAsync(client, "Resume", "resume");

        var response = await client.PatchAsJsonAsync(
            $"/api/portfolios/{portfolio.Id}/draft",
            new UpdateDraftRequest(ValidEmptySnapshot(), 1));

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<UpdateDraftResponse>();
        Assert.NotNull(body);
        Assert.True(body!.DraftUpdatedAt > DateTimeOffset.MinValue);

        var portfolioDoc = await Fx.Firestore.Collection("users").Document("uid-alice")
            .Collection("portfolios").Document(portfolio.Id).GetSnapshotAsync();
        var draft = portfolioDoc.GetValue<Dictionary<string, object>>("draft");
        Assert.Equal(1L, (long)draft["version"]);
        Assert.Equal(1L, portfolioDoc.GetValue<long>("draftSchemaVersion"));
        var refs = portfolioDoc.GetValue<List<object>>("assetRefsDraft");
        Assert.Empty(refs);
    }

    [Fact]
    public async Task Schema_Violation_Returns_400_Draft_Validation()
    {
        var client = Fx.CreateClientFor("uid-alice", "alice@example.com");
        await SignupAsync(client, "alice");
        var portfolio = await CreatePortfolioAsync(client, "x", "x");

        // Broken: pages must be a non-empty array of page objects.
        var broken = Json("""{ "version": 1, "pages": "nope" }""");

        var response = await client.PatchAsJsonAsync(
            $"/api/portfolios/{portfolio.Id}/draft",
            new UpdateDraftRequest(broken, 1));
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await response.Content.ReadAsStringAsync();
        Assert.Contains("draft-validation", problem);
    }

    [Fact]
    public async Task Oversize_Draft_Returns_400_DraftTooLarge()
    {
        var client = Fx.CreateClientFor("uid-alice", "alice@example.com");
        await SignupAsync(client, "alice");
        var portfolio = await CreatePortfolioAsync(client, "x", "x");

        // Pad description with >950 KB of text. The draft passes schema validation
        // (it's a string field) but the byte-cap rejects it.
        var giant = new string('a', (int)PortfolioService.MaxDraftBytes);
        var oversized = Json($$"""
            {
              "version": 1,
              "portfolio": { "title": "x", "description": "{{giant}}" },
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
        """);

        var response = await client.PatchAsJsonAsync(
            $"/api/portfolios/{portfolio.Id}/draft",
            new UpdateDraftRequest(oversized, 1));
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await response.Content.ReadAsStringAsync();
        Assert.Contains("draft-too-large", problem);
    }

    [Fact]
    public async Task Unknown_Portfolio_Returns_404()
    {
        var client = Fx.CreateClientFor("uid-alice", "alice@example.com");
        await SignupAsync(client, "alice");

        var response = await client.PatchAsJsonAsync(
            "/api/portfolios/01HMISSING/draft",
            new UpdateDraftRequest(ValidEmptySnapshot(), 1));
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Soft_Deleted_Portfolio_Returns_404()
    {
        var client = Fx.CreateClientFor("uid-alice", "alice@example.com");
        await SignupAsync(client, "alice");
        var portfolio = await CreatePortfolioAsync(client, "x", "x");
        var del = await client.DeleteAsync($"/api/portfolios/{portfolio.Id}");
        del.EnsureSuccessStatusCode();

        var response = await client.PatchAsJsonAsync(
            $"/api/portfolios/{portfolio.Id}/draft",
            new UpdateDraftRequest(ValidEmptySnapshot(), 1));
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task Missing_Auth_Returns_401()
    {
        var response = await Fx.CreateAnonymousClient().PatchAsJsonAsync(
            "/api/portfolios/any/draft",
            new UpdateDraftRequest(ValidEmptySnapshot(), 1));
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task Last_Write_Wins_Sequential_Updates()
    {
        var client = Fx.CreateClientFor("uid-alice", "alice@example.com");
        await SignupAsync(client, "alice");
        var portfolio = await CreatePortfolioAsync(client, "x", "x");

        Fx.Clock.Advance(TimeSpan.FromMinutes(1));
        var first = ValidEmptySnapshot();
        await client.PatchAsJsonAsync($"/api/portfolios/{portfolio.Id}/draft",
            new UpdateDraftRequest(first, 1));

        Fx.Clock.Advance(TimeSpan.FromMinutes(1));
        var second = Json("""
            {
              "version": 1,
              "portfolio": { "title": "Updated", "description": "" },
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
        """);
        await client.PatchAsJsonAsync($"/api/portfolios/{portfolio.Id}/draft",
            new UpdateDraftRequest(second, 1));

        var portfolioDoc = await Fx.Firestore.Collection("users").Document("uid-alice")
            .Collection("portfolios").Document(portfolio.Id).GetSnapshotAsync();
        var draft = portfolioDoc.GetValue<Dictionary<string, object>>("draft");
        var portfolioMeta = (Dictionary<string, object>)draft["portfolio"];
        Assert.Equal("Updated", portfolioMeta["title"]);
    }
}
