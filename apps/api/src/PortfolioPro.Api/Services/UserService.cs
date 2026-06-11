using Google.Cloud.Firestore;
using PortfolioPro.Api.Errors;
using PortfolioPro.Api.Infrastructure;

namespace PortfolioPro.Api.Services;

public sealed class UserService(FirestoreDb firestore, IClock clock, ILogger<UserService> log)
{
    private const string UsersCollection = "users";
    private const string DeletionQueueCollection = "deletionQueue";
    private static readonly TimeSpan SoftDeleteGrace = TimeSpan.FromDays(7);

    public async Task<UserRecord?> GetByUidAsync(string uid, CancellationToken ct)
    {
        var snap = await firestore.Collection(UsersCollection).Document(uid).GetSnapshotAsync(ct);
        if (!snap.Exists)
            return null;

        var data = snap.ToDictionary();
        return new UserRecord(
            Uid: snap.GetValue<string>("uid"),
            Username: snap.GetValue<string>("username"),
            Email: snap.GetValue<string>("email"),
            CreatedAt: snap.GetValue<Timestamp>("createdAt"),
            UpdatedAt: snap.GetValue<Timestamp>("updatedAt"),
            StorageBytesUsed: data.TryGetValue("storageBytesUsed", out var bytes) && bytes is not null
                ? Convert.ToInt64(bytes)
                : 0L,
            // softDeletedAt is stored as `null` for live users; TryGetValue<Timestamp>
            // throws on null values because Timestamp is a non-nullable struct.
            SoftDeletedAt: data.TryGetValue("softDeletedAt", out var raw) && raw is Timestamp ts
                ? ts
                : null);
    }

    public async Task SoftDeleteAsync(string uid, CancellationToken ct)
    {
        var userDoc = firestore.Collection(UsersCollection).Document(uid);
        var existing = await userDoc.GetSnapshotAsync(ct);
        if (!existing.Exists)
            throw new UserNotFoundException();

        var nowOffset = clock.UtcNow;
        var now = Timestamp.FromDateTime(nowOffset.UtcDateTime);
        var scheduledFor = Timestamp.FromDateTime(nowOffset.Add(SoftDeleteGrace).UtcDateTime);
        var taskId = DeletionQueueTaskId.For(DeletionQueueTaskId.UserKind, uid);
        var queueDoc = firestore.Collection(DeletionQueueCollection).Document(taskId);

        var batch = firestore.StartBatch();
        batch.Update(userDoc, new Dictionary<string, object>
        {
            ["softDeletedAt"] = now,
            ["updatedAt"] = now,
        });
        // Set (not Create) so a repeated soft-delete overwrites the existing task
        // rather than throwing AlreadyExists.
        batch.Set(queueDoc, new Dictionary<string, object>
        {
            ["kind"] = DeletionQueueTaskId.UserKind,
            ["targetUid"] = uid,
            ["targetId"] = uid,
            ["scheduledFor"] = scheduledFor,
        });
        await batch.CommitAsync(ct);

        // Phase 8 hook: also soft-delete every portfolio owned by this user, unpublish
        // any that are live, and enqueue per-portfolio deletion tasks (see
        // docs/publish-flow.md § Account deletion).

        log.LogInformation("Soft-deleted user {Uid}; hard delete scheduled for {ScheduledFor}",
            uid, scheduledFor.ToDateTime());
    }
}
