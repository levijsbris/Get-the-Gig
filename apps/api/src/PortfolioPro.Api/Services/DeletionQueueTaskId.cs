namespace PortfolioPro.Api.Services;

/// <summary>
/// Deterministic Firestore document IDs for /deletionQueue/{taskId}. Using a
/// {kind}-{targetId} key means restore is a direct Delete(deletionQueue/portfolio-{pid})
/// with no query, and re-soft-deleting an entity overwrites the existing task rather
/// than spawning a duplicate.
/// </summary>
public static class DeletionQueueTaskId
{
    public const string UserKind = "user";
    public const string PortfolioKind = "portfolio";
    public const string AssetKind = "asset";

    public static string For(string kind, string targetId) => $"{kind}-{targetId}";
}
