using System.Text.Json;
using NJsonSchema;

namespace PortfolioPro.Api.Snapshot;

/// <summary>
/// Validates a snapshot at two layers:
///
///   1. JSON Schema (shape). Generated from the Zod schema in
///      packages/snapshot-schema, embedded as a manifest resource. Catches
///      missing fields, wrong types, malformed nodes.
///
///   2. Cross-reference and structural invariants the schema can't express:
///        * layout.columns count matches the columns array length
///        * NavTarget references resolve to a page / section in this snapshot
///        * (Phase 5 Image / PDF commit) every assetId belongs to this user
///          and is not soft-deleted
///        * (Phase 5 Container commit) container nesting depth limit
///
/// Cross-reference rules only execute when JSON Schema validation passes —
/// running them against a malformed shape produces cascading nonsense. Each
/// rule emits a string prefixed with its category so callers can route
/// (`[schema]` vs `[crossref:layout]` vs `[crossref:navTarget]`).
/// </summary>
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
        var schemaErrors = _schema.Validate(snapshot.GetRawText());
        if (schemaErrors.Count != 0)
        {
            var messages = schemaErrors
                .Select(e => $"[schema] {e.Path}: {e.Kind}")
                .ToArray();
            return SnapshotValidationResult.Invalid(messages);
        }

        return ValidateCrossReferences(snapshot);
    }

    /// <summary>
    /// Runs only the cross-reference and structural rules, skipping JSON
    /// Schema validation. Exposed for callers (and tests) that have already
    /// validated shape elsewhere or want to test cross-reference rules
    /// against snapshots that intentionally extend the schema. The publish
    /// pipeline (Phase 8) calls Validate(); this method is the seam for
    /// schema-bypass scenarios.
    /// </summary>
    public SnapshotValidationResult ValidateCrossReferences(JsonElement snapshot)
    {
        var errors = new List<string>();
        ValidateLayoutColumnsConsistency(snapshot, errors);
        ValidateNavTargets(snapshot, errors);
        return errors.Count == 0
            ? SnapshotValidationResult.Ok()
            : SnapshotValidationResult.Invalid(errors);
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

    // -- layout.columns vs columns.length ------------------------------------

    private static void ValidateLayoutColumnsConsistency(JsonElement snapshot, List<string> errors)
    {
        if (snapshot.TryGetProperty("pages", out var pages) && pages.ValueKind == JsonValueKind.Array)
        {
            int pageIdx = 0;
            foreach (var page in pages.EnumerateArray())
            {
                if (page.TryGetProperty("sections", out var sections) && sections.ValueKind == JsonValueKind.Array)
                {
                    int sectionIdx = 0;
                    foreach (var section in sections.EnumerateArray())
                    {
                        CheckSectionLayout(section, $"pages[{pageIdx}].sections[{sectionIdx}]", errors);
                        sectionIdx++;
                    }
                }
                pageIdx++;
            }
        }

        if (snapshot.TryGetProperty("globalSections", out var globals)
            && globals.ValueKind == JsonValueKind.Object)
        {
            if (globals.TryGetProperty("header", out var header) && header.ValueKind == JsonValueKind.Object)
                CheckSectionLayout(header, "globalSections.header", errors);
            if (globals.TryGetProperty("footer", out var footer) && footer.ValueKind == JsonValueKind.Object)
                CheckSectionLayout(footer, "globalSections.footer", errors);
        }
    }

    private static void CheckSectionLayout(JsonElement section, string path, List<string> errors)
    {
        if (!section.TryGetProperty("layout", out var layout)) return;
        if (!layout.TryGetProperty("columns", out var layoutColumns)) return;
        if (layoutColumns.ValueKind != JsonValueKind.Number) return;
        if (!section.TryGetProperty("columns", out var columns) || columns.ValueKind != JsonValueKind.Array)
            return;

        var declared = layoutColumns.GetInt32();
        var actual = columns.GetArrayLength();
        if (declared != actual)
        {
            errors.Add(
                $"[crossref:layout] {path}: section.layout.columns is {declared} but columns array has {actual} entries");
        }
    }

    // -- NavTarget cross-references ------------------------------------------

    private static void ValidateNavTargets(JsonElement snapshot, List<string> errors)
    {
        var pageIds = new HashSet<string>(StringComparer.Ordinal);
        var sectionIds = new HashSet<string>(StringComparer.Ordinal);

        if (snapshot.TryGetProperty("pages", out var pages) && pages.ValueKind == JsonValueKind.Array)
        {
            foreach (var page in pages.EnumerateArray())
            {
                if (page.TryGetProperty("id", out var pid) && pid.ValueKind == JsonValueKind.String)
                {
                    var pageId = pid.GetString();
                    if (string.IsNullOrEmpty(pageId)) continue;
                    pageIds.Add(pageId);
                    if (page.TryGetProperty("sections", out var ss) && ss.ValueKind == JsonValueKind.Array)
                    {
                        foreach (var s in ss.EnumerateArray())
                        {
                            if (s.TryGetProperty("id", out var sid) && sid.ValueKind == JsonValueKind.String)
                            {
                                var sectionId = sid.GetString();
                                if (!string.IsNullOrEmpty(sectionId))
                                    sectionIds.Add($"{pageId}:{sectionId}");
                            }
                        }
                    }
                }
            }
        }

        VisitNavTargets(snapshot, "$", pageIds, sectionIds, errors);
    }

    private static void VisitNavTargets(
        JsonElement node,
        string path,
        IReadOnlySet<string> pageIds,
        IReadOnlySet<string> sectionIds,
        List<string> errors)
    {
        switch (node.ValueKind)
        {
            case JsonValueKind.Object:
                if (TryGetNavTargetKind(node, out var kind))
                {
                    CheckNavTarget(node, path, kind!, pageIds, sectionIds, errors);
                }
                foreach (var prop in node.EnumerateObject())
                    VisitNavTargets(prop.Value, $"{path}.{prop.Name}", pageIds, sectionIds, errors);
                break;
            case JsonValueKind.Array:
                int i = 0;
                foreach (var item in node.EnumerateArray())
                {
                    VisitNavTargets(item, $"{path}[{i}]", pageIds, sectionIds, errors);
                    i++;
                }
                break;
        }
    }

    /// <summary>
    /// A NavTarget is any object whose `kind` is one of the four navigation
    /// variants. TokenRef uses `kind: 'token'` and is intentionally excluded.
    /// </summary>
    private static bool TryGetNavTargetKind(JsonElement obj, out string? kind)
    {
        kind = null;
        if (!obj.TryGetProperty("kind", out var kindEl)) return false;
        if (kindEl.ValueKind != JsonValueKind.String) return false;
        var value = kindEl.GetString();
        if (value is "page" or "section" or "url" or "mailto")
        {
            kind = value;
            return true;
        }
        return false;
    }

    private static void CheckNavTarget(
        JsonElement target,
        string path,
        string kind,
        IReadOnlySet<string> pageIds,
        IReadOnlySet<string> sectionIds,
        List<string> errors)
    {
        switch (kind)
        {
            case "page":
                if (target.TryGetProperty("pageId", out var pageRef)
                    && pageRef.ValueKind == JsonValueKind.String)
                {
                    var pageId = pageRef.GetString();
                    if (!string.IsNullOrEmpty(pageId) && !pageIds.Contains(pageId))
                    {
                        errors.Add(
                            $"[crossref:navTarget] {path}: references page '{pageId}' which doesn't exist in this snapshot");
                    }
                }
                break;
            case "section":
                if (target.TryGetProperty("pageId", out var sPage)
                    && target.TryGetProperty("sectionId", out var sSect)
                    && sPage.ValueKind == JsonValueKind.String
                    && sSect.ValueKind == JsonValueKind.String)
                {
                    var key = $"{sPage.GetString()}:{sSect.GetString()}";
                    if (!sectionIds.Contains(key))
                    {
                        errors.Add(
                            $"[crossref:navTarget] {path}: references section '{sSect.GetString()}' on page '{sPage.GetString()}' which doesn't exist in this snapshot");
                    }
                }
                break;
            // url + mailto don't require cross-snapshot resolution (URL / email
            // shape is enforced by the Zod schema).
        }
    }
}
