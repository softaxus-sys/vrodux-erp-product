using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Logging;

namespace Softaxis.BuildingBlocks.Infrastructure.Sync;

/// <summary>
/// Turns SQL Server Change Tracking on for the database and for every table in the mirror's scope.
///
/// <para>
/// <b>Why Change Tracking and not an <c>UpdatedAt</c> watermark.</b> Several write paths in this
/// codebase bypass EF entirely with raw SQL and therefore never touch <c>UpdatedAt</c> - the POS
/// cross-schema stock deduction and restore, and the inventory adjustment of pos products. A
/// watermark sweep, or an EF SaveChanges interceptor, would silently miss exactly the stock data a
/// retail client checks first. Change Tracking sits in the engine and sees every write, whatever
/// issued it. It is also supported on SQL Server Express, which these boxes run; Change Data
/// Capture is not.
/// </para>
///
/// <para>
/// Runs on every startup and is idempotent. That is deliberate rather than a one-off script: a
/// table added by a future migration must be picked up automatically, because a table silently
/// never tracked is a data loss nobody notices until someone goes looking for a row.
/// </para>
///
/// <para>See <c>docs/on-premises-cloud-mirror.md</c> §5.</para>
/// </summary>
public sealed class ChangeTrackingBootstrapper(string connectionString, ILogger logger)
{
    /// <summary>
    /// How much history the database keeps. It is the length of outage the mirror can absorb before
    /// a watermark goes stale and a full reseed becomes the only correct move - a week covers a dead
    /// router over a holiday weekend.
    /// </summary>
    public const int RetentionDays = 7;

    public async Task<ChangeTrackingBootstrapResult> EnableAsync(
        IReadOnlyList<SyncTable> tables, CancellationToken ct = default)
    {
        await using var conn = new SqlConnection(connectionString);
        await conn.OpenAsync(ct);

        var database = conn.Database;
        var enabledNow = 0;

        if (!await IsDatabaseTrackedAsync(conn, ct))
        {
            // The database name cannot be parameterised in ALTER DATABASE. It comes from our own
            // connection string, and is bracket-escaped, so it is not an injection surface.
            var safe = database.Replace("]", "]]");
            await ExecAsync(conn,
                $"ALTER DATABASE [{safe}] SET CHANGE_TRACKING = ON " +
                $"(CHANGE_RETENTION = {RetentionDays} DAYS, AUTO_CLEANUP = ON)", ct);

            logger.LogInformation(
                "Sync: enabled change tracking on {Database} with {Days} days retention.",
                database, RetentionDays);
        }

        var tracked = await ReadTrackedTablesAsync(conn, ct);

        foreach (var t in tables)
        {
            if (tracked.Contains(t.Name)) continue;

            try
            {
                // TRACK_COLUMNS_UPDATED = OFF: the push sends whole rows, so column-level detail
                // would be stored on every write and never read.
                await ExecAsync(conn,
                    $"ALTER TABLE {t.Qualified} ENABLE CHANGE_TRACKING WITH (TRACK_COLUMNS_UPDATED = OFF)", ct);
                enabledNow++;
            }
            catch (SqlException ex)
            {
                // One table that cannot be tracked - no primary key, a permission gap - must not
                // stop the other sixty. It will show up as missing data, so say so loudly.
                logger.LogError(ex, "Sync: could not enable change tracking on {Table}.", t.Name);
            }
        }

        if (enabledNow > 0)
            logger.LogInformation("Sync: change tracking enabled on {Count} newly-tracked table(s).", enabledNow);

        return new ChangeTrackingBootstrapResult(database, tables.Count, enabledNow);
    }

    /// <summary>
    /// Reports tables that exist in a mirrored schema but are NOT in the catalogue - the one blind
    /// spot an allow-list has. Reported rather than auto-included: silently syncing a table nobody
    /// has considered is how cloud-owned data gets overwritten.
    /// </summary>
    public void WarnAboutUncatalogued(
        IEnumerable<(string Schema, string Table, IReadOnlyList<string> KeyColumns, bool HasTenantId)> existing,
        IReadOnlyList<SyncTable> catalogue)
    {
        var known = catalogue.Select(t => t.Name).ToHashSet(StringComparer.OrdinalIgnoreCase);

        foreach (var (schema, table, _, _) in existing)
        {
            var name = $"{schema}.{table}";
            if (known.Contains(name)) continue;

            // Excluded on purpose, with a recorded reason - not a gap.
            if (SyncTableCatalog.BusinessExclusions.Contains(name)) continue;
            if (schema.Equals("identity", StringComparison.OrdinalIgnoreCase) &&
                SyncTableCatalog.IdentityExclusionReasons.ContainsKey(table)) continue;
            if (schema.Equals("identity", StringComparison.OrdinalIgnoreCase)) continue;

            logger.LogWarning(
                "Sync: {Table} exists but is not in the mirror catalogue, so its rows will never " +
                "reach the cloud. Add it to SyncTableCatalog or record why it is excluded.", name);
        }
    }

    private static async Task<bool> IsDatabaseTrackedAsync(SqlConnection conn, CancellationToken ct)
    {
        await using var cmd = conn.CreateCommand();
        cmd.CommandText =
            "SELECT COUNT(*) FROM sys.change_tracking_databases WHERE database_id = DB_ID()";
        return Convert.ToInt32(await cmd.ExecuteScalarAsync(ct)) > 0;
    }

    private static async Task<HashSet<string>> ReadTrackedTablesAsync(SqlConnection conn, CancellationToken ct)
    {
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            SELECT s.name + '.' + t.name
            FROM   sys.change_tracking_tables ct
            JOIN   sys.tables  t ON t.object_id = ct.object_id
            JOIN   sys.schemas s ON s.schema_id = t.schema_id
            """;

        var set = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct)) set.Add(reader.GetString(0));
        return set;
    }

    private static async Task ExecAsync(SqlConnection conn, string sql, CancellationToken ct)
    {
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = sql;
        cmd.CommandTimeout = 120;   // ALTER DATABASE can wait on other sessions
        await cmd.ExecuteNonQueryAsync(ct);
    }
}

public sealed record ChangeTrackingBootstrapResult(string Database, int TablesInScope, int NewlyEnabled);
