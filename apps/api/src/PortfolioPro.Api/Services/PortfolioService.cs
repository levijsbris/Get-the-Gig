using Google.Cloud.Firestore;
using NUlid;
using PortfolioPro.Api.Errors;
using PortfolioPro.Api.Infrastructure;
using PortfolioPro.Api.Snapshot;

namespace PortfolioPro.Api.Services;

public sealed class PortfolioService(
    FirestoreDb firestore,
    IClock clock,
    IEmptySnapshotProvider emptySnapshots,
    ISnapshotValidator snapshotValidator,
    ILogger<PortfolioService> log)
{
    private const string UsersCollection = "users";
    private const string PortfoliosCollection = "portfolios";
    private const string SlugsCollection = "portfolioSlugs";
    private const string DeletionQueueCollection = "deletionQueue";
    private static readonly TimeSpan SoftDeleteGrace = TimeSpan.FromDays(7);

    // 950 KB hard cap per docs/data-model.md — leaves headroom under the
    // Firestore 1 MiB doc limit. The editor warns at 800 KB; this cap is the
    // server's "no further saves" guardrail.
    public const long MaxDraftBytes = 950 * 1024;

    public async Task<PortfolioRecord> CreateAsync(
        string uid, string title, string slug, string description, CancellationToken ct)
    {
        var pid = Ulid.NewUlid().ToString();
        PortfolioRecord? created = null;

        var slugDoc = SlugDoc(uid, slug);
        var portfolioDoc = PortfolioDoc(uid, pid);
        var userDoc = firestore.Collection(UsersCollection).Document(uid);

        await firestore.RunTransactionAsync(async tx =>
        {
            var existingSlug = await tx.GetSnapshotAsync(slugDoc);
            if (existingSlug.Exists)
                throw new SlugConflictException(slug);

            // User doc must exist (the user must have signed up).
            var userSnap = await tx.GetSnapshotAsync(userDoc);
            if (!userSnap.Exists)
                throw new UserNotFoundException();

            var now = Timestamp.FromDateTime(clock.UtcNow.UtcDateTime);

            var draftJson = emptySnapshots.Create();
            draftJson["portfolio"]!["title"] = title;
            draftJson["portfolio"]!["description"] = description;
            var draft = JsonToFirestoreConverter.Convert(draftJson)!;

            tx.Create(slugDoc, new Dictionary<string, object>
            {
                ["pid"] = pid,
                ["claimedAt"] = now,
            });
            tx.Create(portfolioDoc, new Dictionary<string, object?>
            {
                ["id"] = pid,
                ["uid"] = uid,
                ["slug"] = slug,
                ["title"] = title,
                ["description"] = description,
                ["isPublished"] = false,
                ["publishedAt"] = null,
                ["publishedSnapshotPath"] = null,
                ["publishedVisibility"] = null,
                ["requiresPassword"] = false,
                ["draft"] = draft,
                ["draftUpdatedAt"] = now,
                ["draftSchemaVersion"] = 1L,
                ["assetRefsDraft"] = new List<string>(),
                ["assetRefsPublished"] = new List<string>(),
                ["storageBytesPortfolio"] = 0L,
                ["createdAt"] = now,
                ["updatedAt"] = now,
                ["softDeletedAt"] = null,
            });
            tx.Update(userDoc, new Dictionary<string, object>
            {
                ["updatedAt"] = now,
            });

            created = new PortfolioRecord(
                Id: pid,
                Uid: uid,
                Slug: slug,
                Title: title,
                Description: description,
                IsPublished: false,
                RequiresPassword: false,
                CreatedAt: now,
                UpdatedAt: now,
                SoftDeletedAt: null);
        }, cancellationToken: ct);

        log.LogInformation("Created portfolio {PortfolioId} for {Uid} with slug {Slug}", pid, uid, slug);
        return created!;
    }

    public async Task<PortfolioRecord?> GetAsync(string uid, string pid, CancellationToken ct)
    {
        var snap = await PortfolioDoc(uid, pid).GetSnapshotAsync(ct);
        return snap.Exists ? ToRecord(snap) : null;
    }

    public async Task<IReadOnlyList<PortfolioRecord>> ListAsync(string uid, bool includeDeleted, CancellationToken ct)
    {
        var query = firestore
            .Collection(UsersCollection).Document(uid)
            .Collection(PortfoliosCollection)
            .OrderByDescending("updatedAt");

        var snap = await query.GetSnapshotAsync(ct);
        return snap.Documents
            .Select(ToRecord)
            .Where(r => includeDeleted || r.SoftDeletedAt is null)
            .ToList();
    }

    public async Task<PortfolioRecord> UpdateAsync(
        string uid, string pid, string? title, string? description, string? newSlug, CancellationToken ct)
    {
        var portfolioDoc = PortfolioDoc(uid, pid);
        PortfolioRecord? updated = null;

        await firestore.RunTransactionAsync(async tx =>
        {
            var snap = await tx.GetSnapshotAsync(portfolioDoc);
            if (!snap.Exists)
                throw new PortfolioNotFoundException();

            var currentSlug = snap.GetValue<string>("slug");
            var now = Timestamp.FromDateTime(clock.UtcNow.UtcDateTime);
            var update = new Dictionary<string, object>
            {
                ["updatedAt"] = now,
            };

            if (title is not null) update["title"] = title;
            if (description is not null) update["description"] = description;

            if (newSlug is not null && !string.Equals(newSlug, currentSlug, StringComparison.Ordinal))
            {
                var newSlugDoc = SlugDoc(uid, newSlug);
                var newSlugSnap = await tx.GetSnapshotAsync(newSlugDoc);
                if (newSlugSnap.Exists)
                    throw new SlugConflictException(newSlug);

                tx.Create(newSlugDoc, new Dictionary<string, object>
                {
                    ["pid"] = pid,
                    ["claimedAt"] = now,
                });
                tx.Delete(SlugDoc(uid, currentSlug));
                update["slug"] = newSlug;
            }

            tx.Update(portfolioDoc, update);

            updated = ToRecord(snap) with
            {
                Title = title ?? snap.GetValue<string>("title"),
                Description = description ?? snap.GetValue<string>("description"),
                Slug = newSlug ?? currentSlug,
                UpdatedAt = now,
            };
        }, cancellationToken: ct);

        log.LogInformation("Updated portfolio {PortfolioId} for {Uid}", pid, uid);
        return updated!;
    }

    public async Task SoftDeleteAsync(string uid, string pid, CancellationToken ct)
    {
        var portfolioDoc = PortfolioDoc(uid, pid);
        var snap = await portfolioDoc.GetSnapshotAsync(ct);
        if (!snap.Exists)
            throw new PortfolioNotFoundException();

        var data = snap.ToDictionary();
        if (data.TryGetValue("softDeletedAt", out var existingDeleted) && existingDeleted is Timestamp)
        {
            // Idempotent — already soft-deleted.
            return;
        }

        var now = Timestamp.FromDateTime(clock.UtcNow.UtcDateTime);
        var scheduledFor = Timestamp.FromDateTime(clock.UtcNow.Add(SoftDeleteGrace).UtcDateTime);
        var queueDoc = firestore.Collection(DeletionQueueCollection)
            .Document(DeletionQueueTaskId.For(DeletionQueueTaskId.PortfolioKind, pid));

        var batch = firestore.StartBatch();
        batch.Update(portfolioDoc, new Dictionary<string, object>
        {
            ["softDeletedAt"] = now,
            ["updatedAt"] = now,
        });
        batch.Set(queueDoc, new Dictionary<string, object>
        {
            ["kind"] = DeletionQueueTaskId.PortfolioKind,
            ["targetUid"] = uid,
            ["targetId"] = pid,
            ["scheduledFor"] = scheduledFor,
        });
        await batch.CommitAsync(ct);

        log.LogInformation("Soft-deleted portfolio {PortfolioId} for {Uid}", pid, uid);
    }

    public async Task<PortfolioRecord> RestoreAsync(string uid, string pid, CancellationToken ct)
    {
        var portfolioDoc = PortfolioDoc(uid, pid);
        var snap = await portfolioDoc.GetSnapshotAsync(ct);
        if (!snap.Exists)
            throw new PortfolioNotFoundException();

        var data = snap.ToDictionary();
        if (!(data.TryGetValue("softDeletedAt", out var raw) && raw is Timestamp deletedAt))
            throw new PortfolioNotSoftDeletedException();

        var elapsed = clock.UtcNow - deletedAt.ToDateTime();
        if (elapsed > SoftDeleteGrace)
            throw new PortfolioGracePeriodExpiredException();

        var now = Timestamp.FromDateTime(clock.UtcNow.UtcDateTime);
        var queueDoc = firestore.Collection(DeletionQueueCollection)
            .Document(DeletionQueueTaskId.For(DeletionQueueTaskId.PortfolioKind, pid));

        var batch = firestore.StartBatch();
        batch.Update(portfolioDoc, new Dictionary<string, object?>
        {
            ["softDeletedAt"] = null,
            ["updatedAt"] = now,
        });
        batch.Delete(queueDoc);
        await batch.CommitAsync(ct);

        log.LogInformation("Restored portfolio {PortfolioId} for {Uid}", pid, uid);
        return ToRecord(snap) with
        {
            SoftDeletedAt = null,
            UpdatedAt = now,
        };
    }

    public sealed record DraftRecord(
        Dictionary<string, object?> Draft,
        DateTimeOffset DraftUpdatedAt,
        int DraftSchemaVersion);

    public async Task<DraftRecord?> GetDraftAsync(string uid, string portfolioId, CancellationToken ct)
    {
        var snap = await PortfolioDoc(uid, portfolioId).GetSnapshotAsync(ct);
        if (!snap.Exists) return null;
        var data = snap.ToDictionary();
        if (data.TryGetValue("softDeletedAt", out var sd) && sd is Timestamp) return null;

        // Firestore returns nested objects as Dictionary<string, object> — cast through
        // a nullable copy so the JSON serializer can round-trip nulls cleanly.
        var draft = (Dictionary<string, object>)data["draft"];
        var draftCopy = draft.ToDictionary(kv => kv.Key, kv => (object?)kv.Value);
        return new DraftRecord(
            Draft: draftCopy,
            DraftUpdatedAt: snap.GetValue<Timestamp>("draftUpdatedAt").ToDateTimeOffset(),
            DraftSchemaVersion: (int)snap.GetValue<long>("draftSchemaVersion"));
    }

    public async Task<DateTimeOffset> UpdateDraftAsync(
        string uid,
        string portfolioId,
        System.Text.Json.JsonElement draft,
        int draftSchemaVersion,
        CancellationToken ct)
    {
        var portfolioDoc = PortfolioDoc(uid, portfolioId);
        var snap = await portfolioDoc.GetSnapshotAsync(ct);
        if (!snap.Exists)
            throw new PortfolioNotFoundException();
        var data = snap.ToDictionary();
        if (data.TryGetValue("softDeletedAt", out var sd) && sd is Timestamp)
            throw new PortfolioNotFoundException();

        var rawText = draft.GetRawText();
        var byteCount = System.Text.Encoding.UTF8.GetByteCount(rawText);
        if (byteCount > MaxDraftBytes)
            throw new DraftTooLargeException(byteCount, MaxDraftBytes);

        var validation = snapshotValidator.Validate(draft);
        if (!validation.IsValid)
            throw new DraftValidationException(validation.Errors);

        var assetRefs = AssetReferenceWalker.Walk(draft).ToList();

        var parsedNode = System.Text.Json.Nodes.JsonNode.Parse(rawText)
            ?? throw new InvalidOperationException("Snapshot parsed as null after passing schema validation.");
        var draftDict = JsonToFirestoreConverter.Convert(parsedNode);

        var now = Timestamp.FromDateTime(clock.UtcNow.UtcDateTime);
        await portfolioDoc.UpdateAsync(new Dictionary<string, object?>
        {
            ["draft"] = draftDict,
            ["draftUpdatedAt"] = now,
            ["draftSchemaVersion"] = (long)draftSchemaVersion,
            ["assetRefsDraft"] = assetRefs,
            ["updatedAt"] = now,
        }, cancellationToken: ct);

        log.LogInformation(
            "Updated draft for portfolio {PortfolioId} ({Bytes} bytes, {AssetRefCount} asset refs)",
            portfolioId, byteCount, assetRefs.Count);

        return clock.UtcNow;
    }

    private DocumentReference PortfolioDoc(string uid, string pid) =>
        firestore.Collection(UsersCollection).Document(uid).Collection(PortfoliosCollection).Document(pid);

    private DocumentReference SlugDoc(string uid, string slug) =>
        firestore.Collection(UsersCollection).Document(uid).Collection(SlugsCollection).Document(slug);

    private static PortfolioRecord ToRecord(DocumentSnapshot snap)
    {
        var data = snap.ToDictionary();
        return new PortfolioRecord(
            Id: snap.GetValue<string>("id"),
            Uid: snap.GetValue<string>("uid"),
            Slug: snap.GetValue<string>("slug"),
            Title: snap.GetValue<string>("title"),
            Description: snap.GetValue<string>("description"),
            IsPublished: snap.GetValue<bool>("isPublished"),
            RequiresPassword: snap.GetValue<bool>("requiresPassword"),
            CreatedAt: snap.GetValue<Timestamp>("createdAt"),
            UpdatedAt: snap.GetValue<Timestamp>("updatedAt"),
            SoftDeletedAt: data.TryGetValue("softDeletedAt", out var raw) && raw is Timestamp ts ? ts : null);
    }
}
