using System.Reflection;
using System.Text.Json;
using NJsonSchema;

namespace PortfolioPro.Api.Snapshot;

public sealed class SnapshotValidator : ISnapshotValidator
{
    private const string SchemaResourceName = "PortfolioPro.Api.Snapshot.snapshot.schema.json";

    private readonly JsonSchema _schema;

    public SnapshotValidator(ILogger<SnapshotValidator> log)
    {
        var json = ReadEmbeddedResource(SchemaResourceName);
        _schema = JsonSchema.FromJsonAsync(json).GetAwaiter().GetResult();
        log.LogInformation("Loaded snapshot JSON Schema (resource={Resource})", SchemaResourceName);
    }

    public SnapshotValidationResult Validate(JsonElement snapshot)
    {
        var errors = _schema.Validate(snapshot.GetRawText());
        if (errors.Count == 0)
            return SnapshotValidationResult.Ok();

        var messages = errors
            .Select(e => $"{e.Path}: {e.Kind}")
            .ToArray();
        return SnapshotValidationResult.Invalid(messages);
    }

    internal static string ReadEmbeddedResource(string name)
    {
        var asm = typeof(SnapshotValidator).Assembly;
        using var stream = asm.GetManifestResourceStream(name)
            ?? throw new InvalidOperationException(
                $"Embedded resource '{name}' not found. Did the pnpm snapshot-schema build run? " +
                $"Available resources: {string.Join(", ", asm.GetManifestResourceNames())}");
        using var reader = new StreamReader(stream);
        return reader.ReadToEnd();
    }
}
