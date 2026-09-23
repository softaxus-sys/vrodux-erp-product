using Microsoft.Data.SqlClient;

namespace Softaxis.BuildingBlocks.Infrastructure.Sync;

/// <summary>One row to push. <paramref name="Op"/> is <c>U</c> (insert or update) or <c>D</c> (delete).</summary>
/// <param name="Key">Primary key values, in key order. Identifies the row on the other side.</param>
/// <param name="Data">
/// The whole row, or null for a delete. Whole rows rather than deltas: a delta needs the receiver to
/// already hold the correct prior state, while a whole row converges even if an earlier batch was
/// lost or applied twice.
/// </param>
public sealed record SyncRow(string Op, IReadOnlyList<object> Key, IReadOnlyDictionary<string, object?>? Data);

/// <summary>A page of changes for one table, plus the version the caller should record if it lands.</summary>
public sealed record ChangeBatch(
    SyncTable            Table,
    long                 FromVersion,
    long                 ToVersion,
    IReadOnlyList<SyncRow> Rows,
    bool                 HasMore);

/// <summary>Why an incremental read could not be served.</summary>
public enum WatermarkState
{
    /// <summary>The stored version is inside the retention window; an incremental read is valid.</summary>
    Valid,

    /// <summary>
    /// The stored version has aged out. Change Tracking cannot say what changed, so the only correct
    /// move is a full reseed of this table. Continuing would leave the mirror quietly missing rows.
    /// </summary>
    Expired,

    /// <summary>Never synced. The first run is a full seed, not an incremental read.</summary>
    NeverSynced,
}

public interface IChangeCaptureService
{
    /// <summary>The database's current change-tracking version - the upper bound for a run.</summary>
    Task<long> GetCurrentVersionAsync(CancellationToken ct = default);

    /// <summary>Whether an incremental read from <paramref name="fromVersion"/> is still possible.</summary>
    Task<WatermarkState> CheckWatermarkAsync(SyncTable table, long? fromVersion, CancellationToken ct = default);

    /// <summary>
    /// Changes to one table between two versions, capped at <paramref name="maxRows"/> and limited
    /// to the installation's own workspace.
    /// </summary>
    Task<ChangeBatch> ReadChangesAsync(
        SyncTable table, Guid tenantId, long fromVersion, long toVersion, int maxRows,
        CancellationToken ct = default);

    /// <summary>
    /// A page of the full table, for the initial seed and for a reseed after a watermark expires.
    /// Paged by primary key so it is resumable and needs no server-side cursor.
    /// </summary>
    Task<ChangeBatch> ReadSeedPageAsync(
        SyncTable table, Guid tenantId, IReadOnlyList<object>? afterKey, int maxRows,
        CancellationToken ct = default);
}

/// <inheritdoc />
public sealed class SqlChangeCaptureService(string connectionString) : IChangeCaptureService
{
    public async Task<long> GetCurrentVersionAsync(CancellationToken ct = default)
    {
        await using var conn = await OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT CHANGE_TRACKING_CURRENT_VERSION()";
        var v = await cmd.ExecuteScalarAsync(ct);
        return v is null or DBNull ? 0 : Convert.ToInt64(v);
    }

    public async Task<WatermarkState> CheckWatermarkAsync(
        SyncTable table, long? fromVersion, CancellationToken ct = default)
    {
        if (fromVersion is null) return WatermarkState.NeverSynced;

        await using var conn = await OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT CHANGE_TRACKING_MIN_VALID_VERSION(OBJECT_ID(@t))";
        cmd.Parameters.Add(new SqlParameter("@t", table.Name));

        var min = await cmd.ExecuteScalarAsync(ct);

        // NULL means the table is not tracked at all - treat as never synced so the caller seeds it
        // rather than reading changes that do not exist.
        if (min is null or DBNull) return WatermarkState.NeverSynced;

        return fromVersion.Value >= Convert.ToInt64(min)
            ? WatermarkState.Valid
            : WatermarkState.Expired;
    }

    public async Task<ChangeBatch> ReadChangesAsync(
        SyncTable table, Guid tenantId, long fromVersion, long toVersion, int maxRows,
        CancellationToken ct = default)
    {
        var keyJoin = string.Join(" AND ", table.KeyColumns.Select(k => $"t.[{k}] = ct.[{k}]"));
        var keySelect = string.Join(", ", table.KeyColumns.Select(k => $"ct.[{k}] AS __key_{k}"));

        // This installation pushes ITS workspace, not every workspace the database happens to hold.
        // A delete is exempt: the row is already gone, so its tenant cannot be read - and the mirror
        // holds only this tenant's rows, so deleting an id it does not have is a harmless no-op.
        var tenantFilter = table.HasTenantId
            ? "AND (ct.SYS_CHANGE_OPERATION = 'D' OR t.[TenantId] = @tenant)"
            : string.Empty;

        // LEFT JOIN because a deleted row has no current version: the join yields nulls and the
        // operation comes back as 'D'. Bounding on toVersion - taken once at the start of the run -
        // stops a long run chasing a moving target and never finishing.
        //
        // maxRows + 1 is read so the caller can tell "exactly a full page" from "there is more",
        // without a second COUNT over the same range.
        var sql = $"""
            SELECT TOP (@take)
                   ct.SYS_CHANGE_OPERATION AS __op,
                   ct.SYS_CHANGE_VERSION   AS __version,
                   {keySelect},
                   t.*
            FROM   CHANGETABLE(CHANGES {table.Qualified}, @from) AS ct
            LEFT   JOIN {table.Qualified} AS t ON {keyJoin}
            WHERE  ct.SYS_CHANGE_VERSION <= @to
                   {tenantFilter}
            ORDER  BY ct.SYS_CHANGE_VERSION
            """;

        await using var conn = await OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = sql;
        cmd.Parameters.Add(new SqlParameter("@take", maxRows + 1));
        cmd.Parameters.Add(new SqlParameter("@from", fromVersion));
        cmd.Parameters.Add(new SqlParameter("@to", toVersion));
        if (table.HasTenantId) cmd.Parameters.Add(new SqlParameter("@tenant", tenantId));

        var rows = new List<SyncRow>(maxRows);
        long highest = fromVersion;
        var hasMore = false;

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        var map = ColumnMap.From(reader, table);

        while (await reader.ReadAsync(ct))
        {
            if (rows.Count == maxRows) { hasMore = true; break; }

            var op = reader.GetString(map.OpIndex);
            highest = reader.GetInt64(map.VersionIndex);

            var key = map.KeyIndexes.Select(i => reader.GetValue(i)).ToList();

            // 'D' is a delete; 'I' and 'U' both mean "this is the row now" and are sent identically,
            // because the receiver upserts rather than replaying the operation.
            rows.Add(op == "D"
                ? new SyncRow("D", key, null)
                : new SyncRow("U", key, map.ReadData(reader)));
        }

        // A partial page means everything up to toVersion was read; a full page only guarantees
        // progress up to the last row actually taken.
        return new ChangeBatch(table, fromVersion, hasMore ? highest : toVersion, rows, hasMore);
    }

    public async Task<ChangeBatch> ReadSeedPageAsync(
        SyncTable table, Guid tenantId, IReadOnlyList<object>? afterKey, int maxRows,
        CancellationToken ct = default)
    {
        var order = string.Join(", ", table.KeyColumns.Select(k => $"[{k}]"));

        // Keyset pagination, not OFFSET: the seed of a large table would otherwise re-scan
        // everything it has already sent on every page.
        //
        // Composite keys are expanded into the explicit lexicographic form
        //     (a > @k0) OR (a = @k0 AND b > @k1) OR ...
        // rather than the row-value comparison `(a, b) > (@k0, @k1)`. SQL Server does not support
        // row constructors in a comparison and answers with "An expression of non-boolean type
        // specified in a context where a condition is expected", which only shows up on a table
        // with a composite key - the four identity join tables that decide what a user can see.
        var where = string.Empty;
        if (afterKey is { Count: > 0 })
        {
            var terms = new List<string>(table.KeyColumns.Count);
            for (var i = 0; i < table.KeyColumns.Count; i++)
            {
                var equalities = Enumerable.Range(0, i)
                    .Select(j => $"[{table.KeyColumns[j]}] = @k{j}");
                var clause = equalities.Append($"[{table.KeyColumns[i]}] > @k{i}");
                terms.Add($"({string.Join(" AND ", clause)})");
            }
            where = $"WHERE {string.Join(" OR ", terms)}";
        }

        // Same rule as the change read: this workspace only.
        if (table.HasTenantId)
            where = string.IsNullOrEmpty(where)
                ? "WHERE [TenantId] = @tenant"
                : $"{where} AND [TenantId] = @tenant";

        var sql = $"SELECT TOP (@take) * FROM {table.Qualified} {where} ORDER BY {order}";

        await using var conn = await OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = sql;
        cmd.Parameters.Add(new SqlParameter("@take", maxRows + 1));
        if (afterKey is { Count: > 0 })
            for (var i = 0; i < afterKey.Count; i++)
                cmd.Parameters.Add(new SqlParameter($"@k{i}", afterKey[i]));
        if (table.HasTenantId) cmd.Parameters.Add(new SqlParameter("@tenant", tenantId));

        var rows = new List<SyncRow>(maxRows);
        var hasMore = false;

        await using var reader = await cmd.ExecuteReaderAsync(ct);
        var map = ColumnMap.ForSeed(reader, table);

        while (await reader.ReadAsync(ct))
        {
            if (rows.Count == maxRows) { hasMore = true; break; }

            var key = map.KeyIndexes.Select(i => reader.GetValue(i)).ToList();
            rows.Add(new SyncRow("U", key, map.ReadData(reader)));
        }

        return new ChangeBatch(table, 0, 0, rows, hasMore);
    }

    private async Task<SqlConnection> OpenAsync(CancellationToken ct)
    {
        var conn = new SqlConnection(connectionString);
        await conn.OpenAsync(ct);
        return conn;
    }

    /// <summary>
    /// Resolves reader ordinals once per query instead of per row, and knows which columns belong to
    /// the table itself rather than to CHANGETABLE's own metadata.
    /// </summary>
    private sealed class ColumnMap
    {
        private readonly (int Index, string Name)[] _data;

        public int   OpIndex      { get; private init; }
        public int   VersionIndex { get; private init; }
        public int[] KeyIndexes   { get; private init; } = [];

        private ColumnMap((int, string)[] data) => _data = data;

        public static ColumnMap From(SqlDataReader reader, SyncTable table)
        {
            var op  = reader.GetOrdinal("__op");
            var ver = reader.GetOrdinal("__version");
            var keys = table.KeyColumns.Select(k => reader.GetOrdinal($"__key_{k}")).ToArray();

            return new ColumnMap(DataColumns(reader, skipBefore: keys.Max() + 1))
            {
                OpIndex = op, VersionIndex = ver, KeyIndexes = keys,
            };
        }

        public static ColumnMap ForSeed(SqlDataReader reader, SyncTable table) =>
            new(DataColumns(reader, skipBefore: 0))
            {
                KeyIndexes = table.KeyColumns.Select(k => reader.GetOrdinal(k)).ToArray(),
            };

        /// <summary>
        /// The table's own columns. In the change query they sit after the prefixed metadata
        /// columns, which is why the caller passes where the real row starts - a name-based filter
        /// would break on a table that legitimately had a column called <c>__op</c>.
        /// </summary>
        private static (int, string)[] DataColumns(SqlDataReader reader, int skipBefore)
        {
            var cols = new List<(int, string)>();
            for (var i = skipBefore; i < reader.FieldCount; i++)
                cols.Add((i, reader.GetName(i)));
            return cols.ToArray();
        }

        public Dictionary<string, object?> ReadData(SqlDataReader reader)
        {
            var row = new Dictionary<string, object?>(_data.Length, StringComparer.Ordinal);
            foreach (var (index, name) in _data)
                row[name] = reader.IsDBNull(index) ? null : reader.GetValue(index);
            return row;
        }
    }
}
