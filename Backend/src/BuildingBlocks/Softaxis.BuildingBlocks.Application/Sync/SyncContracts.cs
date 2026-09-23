namespace Softaxis.BuildingBlocks.Application.Sync;

/// <summary>
/// One row on the wire. <c>Op</c> is <c>U</c> (insert or update) or <c>D</c> (delete).
///
/// <para>
/// Whole rows, never deltas: a delta needs the receiver to already hold the correct prior state,
/// while a whole row converges even if an earlier batch was lost or applied twice - which, on a shop
/// connection, is the normal case rather than the exceptional one.
/// </para>
/// </summary>
public sealed record SyncRowDto(string Op, IReadOnlyList<object> Key, Dictionary<string, object?>? Data);

/// <summary>
/// One table's changes between two change-tracking versions.
///
/// <para>
/// One table per batch so a checkpoint is meaningful and a failure is attributable, and 500 rows per
/// batch so a bad connection makes partial progress instead of losing a whole night's work.
/// </para>
/// </summary>
public sealed record SyncPushRequest(
    Guid   TenantId,
    string LicenseKey,

    /// <summary>
    /// Idempotency key for the whole batch. The receiver records it and answers a repeat without
    /// reapplying - the case that otherwise causes double application is a response lost to a
    /// timeout, where the sender cannot tell success from failure.
    /// </summary>
    Guid   BatchId,

    string TableName,
    long   FromVersion,
    long   ToVersion,
    IReadOnlyList<SyncRowDto> Rows);

/// <summary>What the receiver did with a batch.</summary>
/// <param name="Applied">Rows inserted, updated or deleted.</param>
/// <param name="Deferred">
/// Rows whose parent had not arrived yet. Held by the receiver and retried on the next batch, so a
/// child arriving before its parent converges instead of failing.
/// </param>
/// <param name="Rejected">Rows that could not be applied at all. Any rejection blocks the watermark.</param>
/// <param name="AlreadyApplied">True when this batch id had already landed; nothing was reapplied.</param>
public sealed record SyncPushResponse(
    Guid   BatchId,
    int    Applied,
    int    Deferred,
    int    Rejected,
    bool   AlreadyApplied,
    IReadOnlyList<string> Errors);
