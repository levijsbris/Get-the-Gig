using System.Text.Json;

namespace PortfolioPro.Api.Snapshot;

public interface ISnapshotValidator
{
    SnapshotValidationResult Validate(JsonElement snapshot);
}

public sealed record SnapshotValidationResult(bool IsValid, IReadOnlyList<string> Errors)
{
    public static SnapshotValidationResult Ok() => new(true, Array.Empty<string>());
    public static SnapshotValidationResult Invalid(IReadOnlyList<string> errors) => new(false, errors);
}
