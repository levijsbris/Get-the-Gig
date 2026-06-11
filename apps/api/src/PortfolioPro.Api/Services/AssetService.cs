using Google.Cloud.Firestore;
using NUlid;
using PortfolioPro.Api.Errors;
using PortfolioPro.Api.Infrastructure;

namespace PortfolioPro.Api.Services;

public sealed class AssetService(
    FirestoreDb firestore,
    IClock clock,
    ISignedUrlService signedUrls,
    IStorageObjectClient storage,
    StorageOptions storageOptions,
    ILogger<AssetService> log)
{
    private const string UsersCollection = "users";
    private const string PortfoliosCollection = "portfolios";
    private const string AssetsCollection = "assets";
    private const string DeletionQueueCollection = "deletionQueue";

    public sealed record UploadRequestResult(
        string AssetId,
        Uri UploadUrl,
        string UploadMethod,
        string StoragePath,
        long PortfolioBytesAfterUpload,
        bool WarnPortfolioQuota);

    public sealed record ListResult(
        IReadOnlyList<AssetRecord> Assets,
        long PortfolioBytesUsed,
        long PortfolioBytesQuota,
        bool WarnPortfolioQuota);

    public async Task<UploadRequestResult> RequestUploadAsync(
        string uid,
        string portfolioId,
        string filename,
        string contentType,
        long byteSize,
        CancellationToken ct)
    {
        var portfolio = await ReadActivePortfolioAsync(uid, portfolioId, ct);
        var bytesUsed = portfolio.GetValue<long>("storageBytesPortfolio");
        var bytesAfter = bytesUsed + byteSize;
        if (bytesAfter > AssetLimits.PortfolioHardCapBytes)
            throw new AssetQuotaExceededException(bytesAfter, AssetLimits.PortfolioHardCapBytes);

        var assetId = Ulid.NewUlid().ToString();
        var storagePath = $"users/{uid}/assets/{assetId}/{filename}";
        var signed = signedUrls.MintUploadUrl(uid, storagePath, contentType);

        log.LogInformation(
            "Issued upload URL for asset {AssetId} in portfolio {PortfolioId} ({Bytes} bytes)",
            assetId, portfolioId, byteSize);

        return new UploadRequestResult(
            AssetId: assetId,
            UploadUrl: signed.Url,
            UploadMethod: signed.Method,
            StoragePath: storagePath,
            PortfolioBytesAfterUpload: bytesAfter,
            WarnPortfolioQuota: bytesAfter >= AssetLimits.PortfolioWarnBytes);
    }

    public async Task<AssetRecord> ConfirmAsync(
        string uid,
        string portfolioId,
        string assetId,
        string filename,
        string contentType,
        long byteSize,
        int? width,
        int? height,
        CancellationToken ct)
    {
        var storagePath = $"users/{uid}/assets/{assetId}/{filename}";
        var meta = await storage.HeadAsync(storagePath, ct);
        if (meta is null)
            throw new StorageObjectMissingException(storagePath);
        if (meta.Size != byteSize)
            throw new StorageObjectMismatchException(
                $"Object size {meta.Size} does not match client-reported byteSize {byteSize}.");
        if (!string.Equals(meta.ContentType, contentType, StringComparison.OrdinalIgnoreCase))
            throw new StorageObjectMismatchException(
                $"Object content-type {meta.ContentType} does not match client-reported {contentType}.");

        var portfolioDoc = firestore.Collection(UsersCollection).Document(uid)
            .Collection(PortfoliosCollection).Document(portfolioId);
        var userDoc = firestore.Collection(UsersCollection).Document(uid);
        var assetDoc = firestore.Collection(UsersCollection).Document(uid)
            .Collection(AssetsCollection).Document(assetId);

        var nowOffset = clock.UtcNow;
        var now = Timestamp.FromDateTime(nowOffset.UtcDateTime);

        await firestore.RunTransactionAsync(async tx =>
        {
            var portfolioSnap = await tx.GetSnapshotAsync(portfolioDoc);
            if (!portfolioSnap.Exists)
                throw new PortfolioNotFoundException();
            var portfolioData = portfolioSnap.ToDictionary();
            if (portfolioData.TryGetValue("softDeletedAt", out var sd) && sd is Timestamp)
                throw new PortfolioNotFoundException();

            var bytesUsed = portfolioSnap.GetValue<long>("storageBytesPortfolio");
            var bytesAfter = bytesUsed + byteSize;
            if (bytesAfter > AssetLimits.PortfolioHardCapBytes)
                throw new AssetQuotaExceededException(bytesAfter, AssetLimits.PortfolioHardCapBytes);

            tx.Create(assetDoc, new Dictionary<string, object?>
            {
                ["id"] = assetId,
                ["uid"] = uid,
                ["ownerPortfolioId"] = portfolioId,
                ["filename"] = filename,
                ["contentType"] = contentType,
                ["byteSize"] = byteSize,
                ["storagePath"] = $"gs://{storageOptions.PrivateBucket}/{storagePath}",
                ["width"] = width,
                ["height"] = height,
                ["createdAt"] = now,
                ["softDeletedAt"] = null,
            });
            tx.Update(portfolioDoc, new Dictionary<string, object>
            {
                ["storageBytesPortfolio"] = FieldValue.Increment(byteSize),
                ["updatedAt"] = now,
            });
            tx.Update(userDoc, new Dictionary<string, object>
            {
                ["storageBytesUsed"] = FieldValue.Increment(byteSize),
                ["updatedAt"] = now,
            });
        }, cancellationToken: ct);

        log.LogInformation(
            "Confirmed asset {AssetId} for portfolio {PortfolioId} ({Bytes} bytes)",
            assetId, portfolioId, byteSize);

        return new AssetRecord(
            Id: assetId,
            Uid: uid,
            OwnerPortfolioId: portfolioId,
            Filename: filename,
            ContentType: contentType,
            ByteSize: byteSize,
            StoragePath: $"gs://{storageOptions.PrivateBucket}/{storagePath}",
            Width: width,
            Height: height,
            CreatedAt: now,
            SoftDeletedAt: null);
    }

    public async Task<ListResult> ListAsync(
        string uid, string portfolioId, string? contentTypePrefix, bool includeDeleted, CancellationToken ct)
    {
        var portfolioSnap = await firestore.Collection(UsersCollection).Document(uid)
            .Collection(PortfoliosCollection).Document(portfolioId)
            .GetSnapshotAsync(ct);
        if (!portfolioSnap.Exists)
            throw new PortfolioNotFoundException();
        var bytesUsed = portfolioSnap.GetValue<long>("storageBytesPortfolio");

        var query = firestore.Collection(UsersCollection).Document(uid)
            .Collection(AssetsCollection)
            .WhereEqualTo("ownerPortfolioId", portfolioId);

        var snap = await query.GetSnapshotAsync(ct);
        var assets = snap.Documents
            .Where(d =>
            {
                var data = d.ToDictionary();
                var isSoftDeleted = data.TryGetValue("softDeletedAt", out var sd) && sd is Timestamp;
                if (!includeDeleted && isSoftDeleted)
                    return false;
                if (contentTypePrefix is null) return true;
                return d.GetValue<string>("contentType").StartsWith(contentTypePrefix, StringComparison.Ordinal);
            })
            .Select(ToRecord)
            .OrderByDescending(a => a.CreatedAt)
            .ToList();

        return new ListResult(
            Assets: assets,
            PortfolioBytesUsed: bytesUsed,
            PortfolioBytesQuota: AssetLimits.PortfolioHardCapBytes,
            WarnPortfolioQuota: bytesUsed >= AssetLimits.PortfolioWarnBytes);
    }

    public async Task<AssetRecord> RestoreAsync(string uid, string portfolioId, string assetId, CancellationToken ct)
    {
        var assetDoc = firestore.Collection(UsersCollection).Document(uid)
            .Collection(AssetsCollection).Document(assetId);
        var portfolioDoc = firestore.Collection(UsersCollection).Document(uid)
            .Collection(PortfoliosCollection).Document(portfolioId);
        var userDoc = firestore.Collection(UsersCollection).Document(uid);

        var assetSnap = await assetDoc.GetSnapshotAsync(ct);
        if (!assetSnap.Exists)
            throw new AssetNotFoundException();
        var assetData = assetSnap.ToDictionary();

        if (!string.Equals(assetSnap.GetValue<string>("ownerPortfolioId"), portfolioId, StringComparison.Ordinal))
            throw new AssetNotFoundException();

        if (!(assetData.TryGetValue("softDeletedAt", out var raw) && raw is Timestamp deletedAt))
            throw new AssetNotSoftDeletedException();

        var elapsed = clock.UtcNow - deletedAt.ToDateTime();
        if (elapsed > TimeSpan.FromDays(7))
            throw new AssetGracePeriodExpiredException();

        var portfolioSnap = await portfolioDoc.GetSnapshotAsync(ct);
        if (!portfolioSnap.Exists)
            throw new PortfolioNotFoundException();

        var bytesUsed = portfolioSnap.GetValue<long>("storageBytesPortfolio");
        var byteSize = assetSnap.GetValue<long>("byteSize");
        var bytesAfter = bytesUsed + byteSize;
        if (bytesAfter > AssetLimits.PortfolioHardCapBytes)
            throw new AssetQuotaExceededException(bytesAfter, AssetLimits.PortfolioHardCapBytes);

        var now = Timestamp.FromDateTime(clock.UtcNow.UtcDateTime);
        var queueDoc = firestore.Collection(DeletionQueueCollection)
            .Document(DeletionQueueTaskId.For(DeletionQueueTaskId.AssetKind, assetId));

        var batch = firestore.StartBatch();
        batch.Update(assetDoc, new Dictionary<string, object?>
        {
            ["softDeletedAt"] = null,
        });
        batch.Update(portfolioDoc, new Dictionary<string, object>
        {
            ["storageBytesPortfolio"] = FieldValue.Increment(byteSize),
            ["updatedAt"] = now,
        });
        batch.Update(userDoc, new Dictionary<string, object>
        {
            ["storageBytesUsed"] = FieldValue.Increment(byteSize),
            ["updatedAt"] = now,
        });
        batch.Delete(queueDoc);
        await batch.CommitAsync(ct);

        log.LogInformation(
            "Restored asset {AssetId} for portfolio {PortfolioId} ({Bytes} bytes)",
            assetId, portfolioId, byteSize);

        return ToRecord(assetSnap) with { SoftDeletedAt = null };
    }

    public async Task SoftDeleteAsync(string uid, string portfolioId, string assetId, CancellationToken ct)
    {
        var assetDoc = firestore.Collection(UsersCollection).Document(uid)
            .Collection(AssetsCollection).Document(assetId);
        var portfolioDoc = firestore.Collection(UsersCollection).Document(uid)
            .Collection(PortfoliosCollection).Document(portfolioId);
        var userDoc = firestore.Collection(UsersCollection).Document(uid);

        var assetSnap = await assetDoc.GetSnapshotAsync(ct);
        if (!assetSnap.Exists)
            throw new AssetNotFoundException();
        var assetData = assetSnap.ToDictionary();

        if (!string.Equals(assetSnap.GetValue<string>("ownerPortfolioId"), portfolioId, StringComparison.Ordinal))
            throw new AssetNotFoundException();

        // Idempotent: already soft-deleted -> no further work.
        if (assetData.TryGetValue("softDeletedAt", out var existing) && existing is Timestamp)
            return;

        // Reference check: Phase 4 will populate portfolio.assetRefsDraft. For
        // Phase 3 this list is always empty (no components exist yet) but the
        // check is wired so Phase 4 doesn't have to retrofit it.
        var portfolioSnap = await portfolioDoc.GetSnapshotAsync(ct);
        if (!portfolioSnap.Exists)
            throw new PortfolioNotFoundException();
        var portfolioData = portfolioSnap.ToDictionary();
        if (portfolioData.TryGetValue("assetRefsDraft", out var refsRaw) && refsRaw is IEnumerable<object?> refs)
        {
            var matching = refs.OfType<string>().Where(r => r == assetId).ToList();
            if (matching.Count > 0)
                throw new AssetReferencedException(matching);
        }

        var byteSize = assetSnap.GetValue<long>("byteSize");
        var nowOffset = clock.UtcNow;
        var now = Timestamp.FromDateTime(nowOffset.UtcDateTime);
        var scheduledFor = Timestamp.FromDateTime(nowOffset.AddDays(7).UtcDateTime);
        var queueDoc = firestore.Collection(DeletionQueueCollection)
            .Document(DeletionQueueTaskId.For(DeletionQueueTaskId.AssetKind, assetId));

        var batch = firestore.StartBatch();
        batch.Update(assetDoc, new Dictionary<string, object>
        {
            ["softDeletedAt"] = now,
        });
        batch.Update(portfolioDoc, new Dictionary<string, object>
        {
            ["storageBytesPortfolio"] = FieldValue.Increment(-byteSize),
            ["updatedAt"] = now,
        });
        batch.Update(userDoc, new Dictionary<string, object>
        {
            ["storageBytesUsed"] = FieldValue.Increment(-byteSize),
            ["updatedAt"] = now,
        });
        batch.Set(queueDoc, new Dictionary<string, object>
        {
            ["kind"] = DeletionQueueTaskId.AssetKind,
            ["targetUid"] = uid,
            ["targetId"] = assetId,
            ["scheduledFor"] = scheduledFor,
        });
        await batch.CommitAsync(ct);

        log.LogInformation(
            "Soft-deleted asset {AssetId} for portfolio {PortfolioId} (freed {Bytes} bytes)",
            assetId, portfolioId, byteSize);
    }

    private async Task<DocumentSnapshot> ReadActivePortfolioAsync(
        string uid, string portfolioId, CancellationToken ct)
    {
        var snap = await firestore.Collection(UsersCollection).Document(uid)
            .Collection(PortfoliosCollection).Document(portfolioId)
            .GetSnapshotAsync(ct);
        if (!snap.Exists)
            throw new PortfolioNotFoundException();
        var data = snap.ToDictionary();
        if (data.TryGetValue("softDeletedAt", out var sd) && sd is Timestamp)
            throw new PortfolioNotFoundException();
        return snap;
    }

    private static AssetRecord ToRecord(DocumentSnapshot snap)
    {
        var data = snap.ToDictionary();
        return new AssetRecord(
            Id: snap.GetValue<string>("id"),
            Uid: snap.GetValue<string>("uid"),
            OwnerPortfolioId: snap.GetValue<string>("ownerPortfolioId"),
            Filename: snap.GetValue<string>("filename"),
            ContentType: snap.GetValue<string>("contentType"),
            ByteSize: snap.GetValue<long>("byteSize"),
            StoragePath: snap.GetValue<string>("storagePath"),
            Width: data.TryGetValue("width", out var w) && w is long wl ? (int)wl : null,
            Height: data.TryGetValue("height", out var h) && h is long hl ? (int)hl : null,
            CreatedAt: snap.GetValue<Timestamp>("createdAt"),
            SoftDeletedAt: data.TryGetValue("softDeletedAt", out var sd) && sd is Timestamp ts ? ts : null);
    }
}
