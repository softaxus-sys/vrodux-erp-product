namespace Softaxis.BuildingBlocks.Application.Storage;

/// <summary>
/// The one way any module reads or writes a binary file (property photos, receipts, avatars,
/// documents) — backed by an S3-compatible bucket (Contabo Object Storage in production) instead
/// of a database column. Registered once in the gateway (see
/// Softaxis.BuildingBlocks.Infrastructure.Storage.ObjectStorageServiceCollectionExtensions), so any
/// service's handler injects this directly without its own DI registration — the same shape as
/// INotificationDispatcher.
///
/// <para><b>Every call is a no-op/returns null when <see cref="IsConfigured"/> is false</b> — never
/// throws for "not configured yet". That is the deliberate state before real Contabo credentials
/// are set, and the state a fresh local dev environment starts in; callers fall back to storing the
/// bytes in their own DB column in that case (see RealEstate's PropertyImage for the reference
/// dual-read/dual-write pattern). Once configured, a transient failure on GET/DELETE is still
/// swallowed and logged where the caller has a safe fallback (an existing DB-stored row, a
/// best-effort cleanup) — only PUT propagates a failure, since a caller that just accepted an
/// upload needs to know it didn't actually land anywhere.</para>
/// </summary>
public interface IObjectStorage
{
    bool IsConfigured { get; }

    /// <summary>Uploads the bytes under <paramref name="key"/>, overwriting any existing object at
    /// that key. Throws on failure — the caller just accepted an upload and must know if it failed
    /// rather than silently recording a reference to nothing.</summary>
    Task PutAsync(string key, byte[] data, string contentType, CancellationToken ct = default);

    /// <summary>Null when not configured, the object doesn't exist, or the read failed — callers
    /// that store object keys alongside a legacy DB-bytes column treat null as "fall back to the
    /// legacy column", not as a hard error.</summary>
    Task<ObjectStorageFile?> GetAsync(string key, CancellationToken ct = default);

    /// <summary>Best-effort — never throws. A failed delete leaves an orphaned object in the
    /// bucket, which costs storage, not correctness; it must never block the caller's own delete of
    /// the record that referenced it.</summary>
    Task DeleteAsync(string key, CancellationToken ct = default);
}

public sealed record ObjectStorageFile(byte[] Data, string ContentType);
