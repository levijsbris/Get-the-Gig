using Google.Cloud.Firestore;
using PortfolioPro.Api.Errors;

namespace PortfolioPro.Api.Services;

public sealed class UsernameService(FirestoreDb firestore, ILogger<UsernameService> log)
{
    private const string UsernamesCollection = "usernames";
    private const string UsersCollection = "users";

    public async Task<bool> IsAvailableAsync(string username, CancellationToken ct)
    {
        var snap = await firestore.Collection(UsernamesCollection).Document(username).GetSnapshotAsync(ct);
        return !snap.Exists;
    }

    public async Task ClaimForNewUserAsync(string uid, string email, string username, CancellationToken ct)
    {
        var usernameDoc = firestore.Collection(UsernamesCollection).Document(username);
        var userDoc = firestore.Collection(UsersCollection).Document(uid);

        await firestore.RunTransactionAsync(async tx =>
        {
            var existingUsername = await tx.GetSnapshotAsync(usernameDoc);
            if (existingUsername.Exists)
                throw new UsernameConflictException(username);

            var existingUser = await tx.GetSnapshotAsync(userDoc);
            if (existingUser.Exists)
                throw new AccountAlreadyExistsException();

            var now = Timestamp.GetCurrentTimestamp();
            tx.Create(usernameDoc, new Dictionary<string, object>
            {
                ["uid"] = uid,
                ["claimedAt"] = now,
            });
            tx.Create(userDoc, new Dictionary<string, object?>
            {
                ["uid"] = uid,
                ["username"] = username,
                ["email"] = email,
                ["createdAt"] = now,
                ["updatedAt"] = now,
                ["storageBytesUsed"] = 0L,
                ["softDeletedAt"] = null,
            });
        }, cancellationToken: ct);

        log.LogInformation("Signed up {Uid} with username {Username}", uid, username);
    }

    public async Task ChangeAsync(string uid, string oldUsername, string newUsername, CancellationToken ct)
    {
        if (string.Equals(oldUsername, newUsername, StringComparison.Ordinal))
            return;

        var oldDoc = firestore.Collection(UsernamesCollection).Document(oldUsername);
        var newDoc = firestore.Collection(UsernamesCollection).Document(newUsername);
        var userDoc = firestore.Collection(UsersCollection).Document(uid);

        await firestore.RunTransactionAsync(async tx =>
        {
            var newExisting = await tx.GetSnapshotAsync(newDoc);
            if (newExisting.Exists)
                throw new UsernameConflictException(newUsername);

            var now = Timestamp.GetCurrentTimestamp();
            tx.Create(newDoc, new Dictionary<string, object>
            {
                ["uid"] = uid,
                ["claimedAt"] = now,
            });
            tx.Delete(oldDoc);
            tx.Update(userDoc, new Dictionary<string, object>
            {
                ["username"] = newUsername,
                ["updatedAt"] = now,
            });
        }, cancellationToken: ct);

        // Phase 8 hook: walk this user's published portfolios, move their snapshot
        // files under the new username's prefix, and rewrite /portfolioRoutes entries
        // (see docs/publish-flow.md § Username change). No-op in Phase 1 because no
        // portfolios exist yet.

        log.LogInformation("Changed username for {Uid}: {OldUsername} -> {NewUsername}",
            uid, oldUsername, newUsername);
    }
}
