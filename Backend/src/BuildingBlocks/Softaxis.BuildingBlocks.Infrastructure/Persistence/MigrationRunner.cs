using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.Extensions.Logging;

namespace Softaxis.BuildingBlocks.Infrastructure.Persistence;

public static class MigrationRunner
{
    /// <summary>
    /// SQL Server: "Cannot release the application lock ... because it is not currently held."
    /// </summary>
    private const int CannotReleaseApplicationLock = 1223;

    /// <summary>
    /// <c>MigrateAsync()</c>, but tolerant of the one failure that happens AFTER the work is done.
    ///
    /// EF takes a session-scoped <c>sp_getapplock</c> named <c>__EFMigrationsLock</c> before
    /// migrating and releases it in <c>SqlServerMigrationDatabaseLock.Dispose()</c>. A session
    /// lock dies with its session, so if that connection is dropped or reset in between — a
    /// killed connection, a pool reset, a second instance racing the same database — SQL Server
    /// has already released the lock and the explicit release then fails with error 1223.
    ///
    /// By that point every pending migration has been applied and committed. The throw is pure
    /// cleanup noise, but because the startup block awaits each service in turn it took down the
    /// whole gateway and skipped every service after it. Swallowing exactly this one error code
    /// is safe; anything else still propagates, so a genuine migration failure still fails loudly
    /// rather than leaving the app running against a half-migrated schema.
    /// </summary>
    /// <summary>How long to keep waiting for a database that is not accepting connections.</summary>
    /// <remarks>
    /// Five attempts at 2s / 4s / 8s / 16s / 30s — a minute in total. Long enough to ride out a
    /// SQL Server restart or a momentary refusal, short enough that a genuinely unreachable
    /// database still fails inside the deploy's health window rather than hanging it.
    ///
    /// The delay is bounded across the whole startup, not per service: the sequence is awaited in
    /// order, so the first step to hit an unreachable database spends the minute and then throws —
    /// the remaining steps never run.
    /// </remarks>
    private static readonly TimeSpan[] ConnectBackoff =
    [
        TimeSpan.FromSeconds(2),
        TimeSpan.FromSeconds(4),
        TimeSpan.FromSeconds(8),
        TimeSpan.FromSeconds(16),
        TimeSpan.FromSeconds(30),
    ];

    public static async Task MigrateTolerantOfLockReleaseAsync(
        this DatabaseFacade database, ILogger? logger = null, CancellationToken ct = default)
    {
        for (var attempt = 0; ; attempt++)
        {
            try
            {
                await database.MigrateAsync(ct);
                return;
            }
            catch (SqlException ex) when (ex.Number == CannotReleaseApplicationLock)
            {
                // Nothing to retry and nothing to repair: the migrations are applied and the lock is
                // already gone. Deliberately not rethrown.
                return;
            }
            catch (SqlException ex) when (IsConnectionFailure(ex) && attempt < ConnectBackoff.Length)
            {
                // The database was not reachable. Retrying is safe: MigrateAsync re-reads
                // __EFMigrationsHistory and applies only what is still pending, so a retry after a
                // partial run continues rather than repeating work.
                var wait = ConnectBackoff[attempt];
                Warn(logger,
                    $"Could not reach the database (SQL error {ex.Number}); retrying in {wait.TotalSeconds:0}s " +
                    $"(attempt {attempt + 1} of {ConnectBackoff.Length}).");
                await Task.Delay(wait, ct);
            }
        }
    }

    /// <summary>
    /// Whether the failure was "could not reach the database" rather than a fault in the migration.
    /// </summary>
    /// <remarks>
    /// <para><c>ClientConnectionId == Guid.Empty</c> is the decisive signal: the client stamps a
    /// connection id as soon as one is established, so an empty one means the handshake never
    /// happened and nothing was executed. That is always safe to retry, and it is exactly what the
    /// production crash showed (error 11002, class 20, id all zeros, thrown from
    /// <c>WaitForPendingOpen</c>).</para>
    ///
    /// <para><see cref="System.Data.Common.DbException.IsTransient"/> covers the rest of the
    /// provider's own transient set — timeouts, resource limits, failover. Anything else, including
    /// a genuine error inside a migration, is NOT retried and still fails loudly.</para>
    /// </remarks>
    private static bool IsConnectionFailure(SqlException ex) =>
        ex.ClientConnectionId == Guid.Empty || ex.IsTransient;

    /// <summary>
    /// Falls back to stderr when no logger is supplied. Migrations run before the host is serving,
    /// and a silent minute-long stall during startup is the one thing an operator must not see —
    /// Serilog writes to the console too, so either way this lands in <c>docker logs</c>.
    /// </summary>
    private static void Warn(ILogger? logger, string message)
    {
        if (logger is not null) logger.LogWarning("{Message}", message);
        else Console.Error.WriteLine($"[migrations] {message}");
    }
}
