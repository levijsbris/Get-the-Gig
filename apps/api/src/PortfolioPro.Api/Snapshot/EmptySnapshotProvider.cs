using System.Text.Json.Nodes;
using NUlid;

namespace PortfolioPro.Api.Snapshot;

public sealed class EmptySnapshotProvider : IEmptySnapshotProvider
{
    internal const string UlidPlaceholder = "__GENERATE_ULID__";
    private const string EmptyResourceName = "PortfolioPro.Api.Snapshot.snapshot.empty.json";

    private readonly string _templateJson;

    public EmptySnapshotProvider(ILogger<EmptySnapshotProvider> log)
    {
        _templateJson = SnapshotValidator.ReadEmbeddedResource(EmptyResourceName);
        log.LogInformation("Loaded empty snapshot template (resource={Resource})", EmptyResourceName);
    }

    public JsonObject Create()
    {
        var root = JsonNode.Parse(_templateJson)
            ?? throw new InvalidOperationException("Empty snapshot template parsed as null.");
        ReplacePlaceholders(root);
        return root.AsObject();
    }

    private static void ReplacePlaceholders(JsonNode node)
    {
        switch (node)
        {
            case JsonObject obj:
                foreach (var (key, value) in obj.ToList())
                {
                    if (value is JsonValue v && v.TryGetValue<string>(out var s) && s == UlidPlaceholder)
                        obj[key] = Ulid.NewUlid().ToString();
                    else if (value is not null)
                        ReplacePlaceholders(value);
                }
                break;
            case JsonArray arr:
                foreach (var item in arr.Where(x => x is not null))
                    ReplacePlaceholders(item!);
                break;
        }
    }
}
