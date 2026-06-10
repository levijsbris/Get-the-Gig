using Google.Cloud.Firestore;

namespace PortfolioPro.Api.Services;

public sealed record UserRecord(
    string Uid,
    string Username,
    string Email,
    Timestamp CreatedAt,
    Timestamp UpdatedAt,
    long StorageBytesUsed,
    Timestamp? SoftDeletedAt);
