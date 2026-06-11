using System.Text.Json;
using PortfolioPro.Api.Snapshot;
using Xunit;

namespace PortfolioPro.Api.Tests.Snapshot;

public sealed class AssetReferenceWalkerTests
{
    [Fact]
    public void Empty_Snapshot_Returns_Empty_Set()
    {
        var doc = JsonDocument.Parse("""{"version": 1, "pages": []}""");
        var refs = AssetReferenceWalker.Walk(doc.RootElement);
        Assert.Empty(refs);
    }

    [Fact]
    public void Text_Only_Phase_4_Snapshot_Returns_Empty_Set()
    {
        var doc = JsonDocument.Parse("""
            {
              "version": 1,
              "pages": [{
                "id": "p1", "slug": "home", "title": "Home",
                "sections": [{
                  "id": "s1",
                  "background": {},
                  "layout": { "columns": 1 },
                  "columns": [{
                    "id": "c1",
                    "components": [
                      { "id": "t1", "type": "text", "doc": { "type": "doc", "content": [] } }
                    ]
                  }]
                }]
              }]
            }
        """);
        Assert.Empty(AssetReferenceWalker.Walk(doc.RootElement));
    }

    [Fact]
    public void Components_With_AssetId_Are_Emitted_Regardless_Of_Type()
    {
        // Forward-compatible: works for any future component that has an assetId.
        var doc = JsonDocument.Parse("""
            {
              "pages": [{
                "sections": [{
                  "columns": [{
                    "components": [
                      { "id": "i1", "type": "image", "assetId": "01HASSETONE" },
                      { "id": "i2", "type": "image", "assetId": "01HASSETTWO" },
                      { "id": "t1", "type": "text", "doc": { "type": "doc", "content": [] } },
                      { "id": "p1", "type": "pdf", "assetId": "01HASSETONE" }
                    ]
                  }]
                }]
              }]
            }
        """);
        var refs = AssetReferenceWalker.Walk(doc.RootElement);
        Assert.Equal(2, refs.Count);
        Assert.Contains("01HASSETONE", refs);
        Assert.Contains("01HASSETTWO", refs);
    }

    [Fact]
    public void Empty_String_AssetIds_Are_Skipped()
    {
        var doc = JsonDocument.Parse("""
            { "components": [{ "type": "image", "assetId": "" }] }
        """);
        Assert.Empty(AssetReferenceWalker.Walk(doc.RootElement));
    }
}
