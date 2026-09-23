namespace Softaxis.BuildingBlocks.Application.Sync;

/// <summary>
/// Tells someone when the nightly push stops working, and when it starts again.
///
/// <para>
/// Nothing about cloud sync is visible until it breaks: a shop trades normally whether or not last
/// night ran, so without an alert the first sign of trouble is somebody eventually noticing the
/// cloud copy is a fortnight stale. That is the failure this exists to prevent.
/// </para>
///
/// <para>
/// Declared here and implemented by the host, because sending needs email and the notification
/// store - neither of which BuildingBlocks can reach without every service depending on Identity.
/// A host that registers nothing gets <see cref="NullSyncAlerter"/> and simply stays quiet; the
/// push itself is unaffected.
/// </para>
/// </summary>
public interface ISyncAlerter
{
    /// <summary>
    /// A run failed. <paramref name="consecutiveFailures"/> is how many in a row, so the
    /// implementation can decide whether this one is worth announcing.
    /// </summary>
    Task FailedAsync(Guid tenantId, int consecutiveFailures, string error, CancellationToken ct = default);

    /// <summary>
    /// A run succeeded after at least one failure. Only ever called when somebody was told it broke -
    /// an all-clear to a person who never heard the alarm is just noise.
    /// </summary>
    Task RecoveredAsync(Guid tenantId, int previousFailures, CancellationToken ct = default);
}

/// <summary>Used when the host registers no alerter. Silent by design, never throws.</summary>
public sealed class NullSyncAlerter : ISyncAlerter
{
    public Task FailedAsync(Guid tenantId, int consecutiveFailures, string error, CancellationToken ct = default)
        => Task.CompletedTask;

    public Task RecoveredAsync(Guid tenantId, int previousFailures, CancellationToken ct = default)
        => Task.CompletedTask;
}
