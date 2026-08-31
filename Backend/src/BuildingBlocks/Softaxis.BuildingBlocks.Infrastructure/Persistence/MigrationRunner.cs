using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;

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
    public static async Task MigrateTolerantOfLockReleaseAsync(
        this DatabaseFacade database, CancellationToken ct = default)
    {
        try
        {
            await database.MigrateAsync(ct);
        }
        catch (SqlException ex) when (ex.Number == CannotReleaseApplicationLock)
        {
            // Nothing to retry and nothing to repair: the migrations are applied and the lock is
            // already gone. Deliberately not rethrown.
        }
    }
}
