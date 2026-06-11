using System.Text.Json.Nodes;

namespace PortfolioPro.Api.Snapshot;

public interface IEmptySnapshotProvider
{
    /// <summary>
    /// Returns a fresh empty-portfolio snapshot. Every "__GENERATE_ULID__" placeholder
    /// emitted by the snapshot-schema build is replaced with a unique ULID, so each
    /// call produces a snapshot whose internal IDs do not collide with any other call.
    /// </summary>
    JsonObject Create();
}
