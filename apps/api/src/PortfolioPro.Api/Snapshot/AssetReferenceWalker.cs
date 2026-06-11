using System.Collections.Immutable;
using System.Text.Json;

namespace PortfolioPro.Api.Snapshot;

/// <summary>
/// Walks a snapshot JSON tree and emits every distinct assetId it finds. The
/// walker is structural — it looks for ANY object with an "assetId" string
/// property regardless of the component type — so Phase 5's Image / PDF / Card
/// don't need to retrofit the walker. Returns an empty set for Phase 4 snapshots
/// because TextComponent has no assetId.
///
/// Used by the publish pipeline (Phase 8) AND draft autosave (Phase 4) to keep
/// the portfolio doc's assetRefsDraft / assetRefsPublished current. The asset
/// soft-delete reference check reads assetRefsDraft to decide whether a delete
/// would orphan a live reference.
/// </summary>
public static class AssetReferenceWalker
{
    public static ImmutableHashSet<string> Walk(JsonElement snapshot)
    {
        var refs = ImmutableHashSet.CreateBuilder<string>(StringComparer.Ordinal);
        Visit(snapshot, refs);
        return refs.ToImmutable();
    }

    private static void Visit(JsonElement node, ImmutableHashSet<string>.Builder refs)
    {
        switch (node.ValueKind)
        {
            case JsonValueKind.Object:
                if (node.TryGetProperty("assetId", out var assetId)
                    && assetId.ValueKind == JsonValueKind.String)
                {
                    var value = assetId.GetString();
                    if (!string.IsNullOrEmpty(value))
                        refs.Add(value);
                }
                foreach (var prop in node.EnumerateObject())
                    Visit(prop.Value, refs);
                break;

            case JsonValueKind.Array:
                foreach (var item in node.EnumerateArray())
                    Visit(item, refs);
                break;
        }
    }
}
