using System.Text.Json.Nodes;

namespace PortfolioPro.Api.Services;

/// <summary>
/// Converts a System.Text.Json JsonNode tree (as produced by IEmptySnapshotProvider)
/// into the Dictionary&lt;string, object?&gt; / List&lt;object?&gt; / primitive shape
/// that Google.Cloud.Firestore's data conversion layer understands for arbitrary
/// nested writes.
/// </summary>
internal static class JsonToFirestoreConverter
{
    public static object? Convert(JsonNode? node)
    {
        if (node is null) return null;
        return node switch
        {
            JsonObject obj => ConvertObject(obj),
            JsonArray arr => arr.Select(Convert).ToList(),
            JsonValue v => ConvertValue(v),
            _ => null,
        };
    }

    private static Dictionary<string, object?> ConvertObject(JsonObject obj) =>
        obj.ToDictionary(kv => kv.Key, kv => Convert(kv.Value));

    private static object? ConvertValue(JsonValue v)
    {
        if (v.TryGetValue<bool>(out var b)) return b;
        if (v.TryGetValue<long>(out var i)) return i;
        if (v.TryGetValue<double>(out var d)) return d;
        if (v.TryGetValue<string>(out var s)) return s;
        return null;
    }
}
