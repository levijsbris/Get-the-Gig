using System.Text.Json;
using Microsoft.Extensions.Logging.Abstractions;
using PortfolioPro.Api.Snapshot;
using Xunit;

namespace PortfolioPro.Api.Tests.Snapshot;

/// <summary>
/// Cross-reference validation tests. Each rule has positive (well-formed)
/// and negative (broken) coverage. The two cross-reference rules wired in
/// the Phase 5 pre-work commit:
///   * layout.columns vs columns.length consistency
///   * NavTarget page / section references resolve
/// </summary>
public sealed class SnapshotValidatorTests
{
    private static SnapshotValidator BuildValidator() =>
        new(NullLogger<SnapshotValidator>.Instance);

    private static JsonElement Parse(string json) =>
        JsonDocument.Parse(json).RootElement;

    // -- layout.columns consistency ------------------------------------------

    [Fact]
    public void Validate_Passes_When_Layout_Columns_Matches_Array_Length()
    {
        var json = BuildSnapshot(BuildSectionJson(2, columnCount: 2));
        var result = BuildValidator().Validate(Parse(json));
        Assert.True(result.IsValid, string.Join("; ", result.Errors));
    }

    [Fact]
    public void Validate_Rejects_Layout_Columns_Mismatch_With_Code_And_Path()
    {
        var json = BuildSnapshot(BuildSectionJson(3, columnCount: 2));
        var result = BuildValidator().Validate(Parse(json));
        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.StartsWith("[crossref:layout]"));
        Assert.Contains(result.Errors, e => e.Contains("pages[0].sections[0]"));
        Assert.Contains(result.Errors, e => e.Contains("is 3 but columns array has 2"));
    }

    // -- NavTarget cross-reference -------------------------------------------
    // These tests target ValidateCrossReferences directly because the Phase 4
    // TextComponent schema doesn't include a `link` field yet — that lands in
    // the Phase 5 component commits (Image, Button, Card, etc.). Cross-ref
    // logic is exercised independently here so the rules are battle-tested
    // before any component schema references them.

    [Fact]
    public void CrossReferences_Pass_For_NavTarget_Page_Pointing_At_Existing_Page()
    {
        var component = ComponentWithExtraProp(
            "link",
            "{\"kind\":\"page\",\"pageId\":\"01HOMEPAGE\"}");
        var section = BuildSectionJson(1, columnCount: 1, firstColumnComponentJson: component);
        var json = BuildSnapshot(section, homeId: "01HOMEPAGE");
        var result = BuildValidator().ValidateCrossReferences(Parse(json));
        Assert.True(result.IsValid, string.Join("; ", result.Errors));
    }

    [Fact]
    public void CrossReferences_Reject_NavTarget_Page_With_Unresolved_PageId()
    {
        var component = ComponentWithExtraProp(
            "link",
            "{\"kind\":\"page\",\"pageId\":\"01NOPE\"}");
        var section = BuildSectionJson(1, columnCount: 1, firstColumnComponentJson: component);
        var json = BuildSnapshot(section, homeId: "01HOMEPAGE");
        var result = BuildValidator().ValidateCrossReferences(Parse(json));
        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.StartsWith("[crossref:navTarget]"));
        Assert.Contains(result.Errors, e => e.Contains("01NOPE"));
    }

    [Fact]
    public void CrossReferences_Pass_For_NavTarget_Section_When_Both_Ids_Exist()
    {
        var component = ComponentWithExtraProp(
            "link",
            "{\"kind\":\"section\",\"pageId\":\"01HOMEPAGE\",\"sectionId\":\"01SEC\"}");
        var section = BuildSectionJson(1, columnCount: 1, sectionId: "01SEC", firstColumnComponentJson: component);
        var json = BuildSnapshot(section, homeId: "01HOMEPAGE");
        var result = BuildValidator().ValidateCrossReferences(Parse(json));
        Assert.True(result.IsValid, string.Join("; ", result.Errors));
    }

    [Fact]
    public void CrossReferences_Reject_NavTarget_Section_With_Unresolved_SectionId()
    {
        var component = ComponentWithExtraProp(
            "link",
            "{\"kind\":\"section\",\"pageId\":\"01HOMEPAGE\",\"sectionId\":\"01MISSING\"}");
        var section = BuildSectionJson(1, columnCount: 1, sectionId: "01SEC", firstColumnComponentJson: component);
        var json = BuildSnapshot(section, homeId: "01HOMEPAGE");
        var result = BuildValidator().ValidateCrossReferences(Parse(json));
        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.StartsWith("[crossref:navTarget]"));
        Assert.Contains(result.Errors, e => e.Contains("01MISSING"));
    }

    [Fact]
    public void CrossReferences_Ignore_TokenRef_Objects_With_Kind_Token()
    {
        // TokenRef uses `kind: 'token'` and must NOT be treated as a NavTarget.
        var component = ComponentWithExtraProp(
            "color",
            "{\"kind\":\"token\",\"path\":\"colors.primary\"}");
        var section = BuildSectionJson(1, columnCount: 1, firstColumnComponentJson: component);
        var json = BuildSnapshot(section, homeId: "01HOMEPAGE");
        var result = BuildValidator().ValidateCrossReferences(Parse(json));
        Assert.True(result.IsValid, string.Join("; ", result.Errors));
    }

    [Fact]
    public void CrossReferences_Accept_External_Url_NavTarget_Without_Resolution()
    {
        var component = ComponentWithExtraProp(
            "link",
            "{\"kind\":\"url\",\"href\":\"https://example.com\",\"openInNewTab\":false}");
        var section = BuildSectionJson(1, columnCount: 1, firstColumnComponentJson: component);
        var json = BuildSnapshot(section, homeId: "01HOMEPAGE");
        var result = BuildValidator().ValidateCrossReferences(Parse(json));
        Assert.True(result.IsValid, string.Join("; ", result.Errors));
    }

    // -- helpers --------------------------------------------------------------

    /// <summary>
    /// Builds a text component JSON with one extra property whose value is
    /// raw JSON (e.g. a NavTarget or TokenRef). Constructed via concatenation
    /// to avoid C# raw-string-interpolation brace-counting headaches.
    /// </summary>
    private static string ComponentWithExtraProp(string propName, string rawJsonValue) =>
        "{\"id\":\"c1\",\"type\":\"text\",\"doc\":{\"type\":\"doc\",\"content\":[]},\""
        + propName + "\":" + rawJsonValue + "}";

    private static string BuildSectionJson(
        int declaredColumns,
        int columnCount,
        string sectionId = "01SECDEFAULT",
        string? firstColumnComponentJson = null)
    {
        var columns = new List<string>();
        for (int i = 0; i < columnCount; i++)
        {
            var components = (i == 0 && firstColumnComponentJson is not null)
                ? firstColumnComponentJson
                : string.Empty;
            columns.Add("{\"id\":\"col" + i + "\",\"components\":[" + components + "]}");
        }
        return "{\"id\":\"" + sectionId + "\",\"background\":{},\"layout\":{\"columns\":"
            + declaredColumns + "},\"columns\":[" + string.Join(",", columns) + "]}";
    }

    private static string BuildSnapshot(string sectionJson, string homeId = "01HOMEPAGE") =>
        "{\"version\":1,"
        + "\"portfolio\":{\"title\":\"T\",\"description\":\"\"},"
        + "\"theme\":{"
        + "\"fonts\":{\"heading\":\"Inter\",\"body\":\"Inter\"},"
        + "\"colors\":{\"background\":\"#fff\",\"surface\":\"#f7f7f8\",\"foreground\":\"#0f172a\","
        + "\"muted\":\"#64748b\",\"primary\":\"#0f172a\",\"accent\":\"#0ea5e9\"},"
        + "\"spacing\":{\"xs\":4,\"sm\":8,\"md\":16,\"lg\":32,\"xl\":64},"
        + "\"radii\":{\"sm\":4,\"md\":8,\"lg\":16}},"
        + "\"globalSections\":{\"header\":null,\"footer\":null},"
        + "\"pages\":[{\"id\":\"" + homeId + "\",\"slug\":\"home\",\"title\":\"Home\","
        + "\"sections\":[" + sectionJson + "]}]}";
}
