using System.Text.Json;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Logging;
using Softaxis.BuildingBlocks.Application.Sync;

namespace Softaxis.BuildingBlocks.Infrastructure.Sync;

/// <summary>
/// Applies pushed batches on the CLOUD side of a mirror.
///
/// <para>
/// Everything here is written defensively, because every value arrives over the wire: the table name
/// is checked against the catalogue built from this database's own schema, every column is checked
/// against <c>sys.columns</c>, and every row's tenant is checked against the authenticated batch. A
/// receiver that trusts its input is a way to write arbitrary rows into any table.
/// </para>
///
/// <para>See <c>docs/on-premises-cloud-mirror.md</c> §6.</para>
/// </summary>
public sealed class SyncReceiveStore(string connectionString, ILogger logger)
{
    private const string Schema        = "sync";
    private const string BatchLedger   = "[sync].[received_batches]";
    private const string DeferredRows  = "[sync].[deferred_rows]";

    /// <summary>Creates the ledger and the deferred-row queue. Idempotent; safe on every startup.</summary>
    public async Task EnsureCreatedAsync(CancellationToken ct = default)
    {
        const string sql = $"""
            IF SCHEMA_ID('{Schema}') IS NULL EXEC('CREATE SCHEMA [{Schema}]');

            IF OBJECT_ID('{BatchLedger}') IS NULL
            CREATE TABLE {BatchLedger}
            (
                BatchId    UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_sync_received_batches PRIMARY KEY,
                TenantId   UNIQUEIDENTIFIER NOT NULL,
                TableName  NVARCHAR(256)    NOT NULL,
                RowCount_  INT              NOT NULL,
                ToVersion  BIGINT           NOT NULL,
                ReceivedAt DATETIME2        NOT NULL CONSTRAINT DF_sync_received_at DEFAULT SYSUTCDATETIME()
            );

            IF OBJECT_ID('{DeferredRows}') IS NULL
            CREATE TABLE {DeferredRows}
            (
                Id         BIGINT IDENTITY(1,1) CONSTRAINT PK_sync_deferred_rows PRIMARY KEY,
                TenantId   UNIQUEIDENTIFIER NOT NULL,
                TableName  NVARCHAR(256)    NOT NULL,
                KeyJson    NVARCHAR(900)    NOT NULL,
                Payload    NVARCHAR(MAX)    NOT NULL,
                Attempts   INT              NOT NULL CONSTRAINT DF_sync_deferred_attempts DEFAULT(0),
                LastError  NVARCHAR(2000)   NULL,
                DeferredAt DATETIME2        NOT NULL CONSTRAINT DF_sync_deferred_at DEFAULT SYSUTCDATETIME()
            );

            -- One held row per key: a later batch carrying the same row supersedes the earlier
            -- attempt rather than queueing a second copy of it.
            IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_sync_deferred_rows_key')
            CREATE UNIQUE INDEX UX_sync_deferred_rows_key
                ON {DeferredRows} (TenantId, TableName, KeyJson);
            """;

        await using var conn = await OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = sql;
        await cmd.ExecuteNonQueryAsync(ct);
    }

    /// <summary>
    /// Applies one batch. Safe to call repeatedly with the same <c>BatchId</c>: a repeat is
    /// recognised from the ledger and acknowledged without touching a row.
    /// </summary>
    public async Task<SyncPushResponse> ApplyAsync(
        SyncPushRequest request, IReadOnlyList<SyncTable> catalogue, CancellationToken ct = default)
    {
        var errors = new List<string>();

        var table = catalogue.FirstOrDefault(t =>
            t.Name.Equals(request.TableName, StringComparison.OrdinalIgnoreCase));

        if (table is null)
        {
            // Not in the catalogue means either a schema drift between the two sides or something
            // trying to write somewhere it should not. Either way, refuse and say which.
            return Reject(request, $"'{request.TableName}' is not a table this mirror accepts.");
        }

        await using var conn = await OpenAsync(ct);

        if (await BatchAlreadyAppliedAsync(conn, request.BatchId, ct))
            return new SyncPushResponse(request.BatchId, 0, 0, 0, AlreadyApplied: true, []);

        var columns = await ReadWritableColumnsAsync(conn, table, ct);

        // Reject on an unknown column rather than dropping it. Dropping would leave the mirror
        // quietly incomplete with nothing to notice it; rejecting surfaces the schema drift, which
        // is an operational problem someone has to fix either way.
        var unknown = request.Rows
            .Where(r => r.Data is not null)
            .SelectMany(r => r.Data!.Keys)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .Where(c => !columns.ContainsKey(c))
            .ToList();

        if (unknown.Count > 0)
        {
            return Reject(request,
                $"{table.Name} received column(s) this database does not have: {string.Join(", ", unknown.Take(5))}. " +
                "The two sides are on different schema versions.");
        }

        var applied  = 0;
        var deferred = 0;
        var rejected = 0;

        // Drain what an earlier batch could not place yet. Doing it first means a parent that has
        // just arrived immediately unblocks its children, without waiting for a run to finish.
        var (drainedOk, drainedStillStuck) = await DrainDeferredAsync(conn, request.TenantId, catalogue, columns, table, ct);
        applied  += drainedOk;
        deferred += drainedStillStuck;

        await using (var tx = (SqlTransaction)await conn.BeginTransactionAsync(ct))
        {
            foreach (var row in request.Rows)
            {
                if (ct.IsCancellationRequested) break;

                var outcome = await ApplyRowAsync(conn, tx, table, columns, request.TenantId, row, ct);
                switch (outcome.Kind)
                {
                    case RowOutcome.Applied:  applied++;  break;
                    case RowOutcome.Deferred: deferred++; break;
                    default:
                        rejected++;
                        if (errors.Count < 20) errors.Add(outcome.Error!);
                        break;
                }
            }

            // The ledger entry is written inside the same transaction as the rows it describes. If
            // it were separate, a crash between them would either re-apply a landed batch or skip
            // an unlanded one.
            await RecordBatchAsync(conn, tx, request, applied, ct);
            await tx.CommitAsync(ct);
        }

        if (deferred > 0)
            logger.LogInformation(
                "Sync: {Table} - {Deferred} row(s) waiting on a parent that has not arrived yet.",
                table.Name, deferred);

        return new SyncPushResponse(request.BatchId, applied, deferred, rejected, false, errors);
    }

    // ── Row application ───────────────────────────────────────────────────────

    private enum RowOutcome { Applied, Deferred, Rejected }

    private readonly record struct RowResult(RowOutcome Kind, string? Error);

    private async Task<RowResult> ApplyRowAsync(
        SqlConnection conn, SqlTransaction tx, SyncTable table,
        IReadOnlyDictionary<string, ColumnInfo> columns, Guid tenantId, SyncRowDto row,
        CancellationToken ct)
    {
        if (row.Key.Count != table.KeyColumns.Count)
            return new RowResult(RowOutcome.Rejected,
                $"{table.Name}: expected {table.KeyColumns.Count} key value(s), got {row.Key.Count}.");

        // A batch is authenticated for one tenant. A row claiming a different one is either a bug in
        // the sender or an attempt to write into another workspace; neither is acceptable.
        if (row.Data is not null &&
            columns.ContainsKey("TenantId") &&
            row.Data.TryGetValue("TenantId", out var rowTenant) &&
            rowTenant is not null &&
            Guid.TryParse(rowTenant.ToString(), out var parsed) &&
            parsed != tenantId)
        {
            return new RowResult(RowOutcome.Rejected,
                $"{table.Name}: row carries tenant {parsed}, which this batch is not authenticated for.");
        }

        try
        {
            if (row.Op == "D")
            {
                await DeleteAsync(conn, tx, table, row.Key, ct);
                return new RowResult(RowOutcome.Applied, null);
            }

            if (row.Data is null)
                return new RowResult(RowOutcome.Rejected, $"{table.Name}: an upsert arrived with no row data.");

            await UpsertAsync(conn, tx, table, columns, row, ct);
            return new RowResult(RowOutcome.Applied, null);
        }
        catch (SqlException ex) when (IsForeignKeyViolation(ex))
        {
            // Not an error: the parent is simply in a batch that has not arrived yet. Hold the row
            // and try again next time rather than failing the push over ordering.
            await DeferAsync(conn, tx, tenantId, table, row, ex.Message, ct);
            return new RowResult(RowOutcome.Deferred, null);
        }
        catch (SqlException ex)
        {
            return new RowResult(RowOutcome.Rejected, $"{table.Name}: {ex.Message}");
        }
    }

    private static async Task UpsertAsync(
        SqlConnection conn, SqlTransaction tx, SyncTable table,
        IReadOnlyDictionary<string, ColumnInfo> columns, SyncRowDto row, CancellationToken ct)
    {
        var data = row.Data!;
        var keySet = table.KeyColumns.ToHashSet(StringComparer.OrdinalIgnoreCase);

        var writable = data.Keys.Where(c => columns[c].IsWritable).ToList();
        var setCols  = writable.Where(c => !keySet.Contains(c)).ToList();

        var where = string.Join(" AND ", table.KeyColumns.Select((k, i) => $"[{k}] = @k{i}"));

        // Update first, insert if nothing matched. Not MERGE - it has a long history of concurrency
        // surprises, and this is the only writer on the mirror.
        var sql = setCols.Count > 0
            ? $"""
               UPDATE {table.Qualified}
               SET    {string.Join(", ", setCols.Select(c => $"[{c}] = @c_{c}"))}
               WHERE  {where};

               IF @@ROWCOUNT = 0
                   INSERT INTO {table.Qualified} ({string.Join(", ", writable.Select(c => $"[{c}]"))})
                   VALUES ({string.Join(", ", writable.Select(c => $"@c_{c}"))});
               """
            // Key-only tables (the identity join tables) have nothing to update: the row's existence
            // IS the fact. Insert when absent, otherwise leave it alone.
            : $"""
               IF NOT EXISTS (SELECT 1 FROM {table.Qualified} WHERE {where})
                   INSERT INTO {table.Qualified} ({string.Join(", ", writable.Select(c => $"[{c}]"))})
                   VALUES ({string.Join(", ", writable.Select(c => $"@c_{c}"))});
               """;

        await using var cmd = conn.CreateCommand();
        cmd.Transaction = tx;
        cmd.CommandText = sql;

        for (var i = 0; i < row.Key.Count; i++)
            cmd.Parameters.Add(new SqlParameter($"@k{i}", Normalise(row.Key[i])));

        foreach (var c in writable)
            cmd.Parameters.Add(new SqlParameter($"@c_{c}", Normalise(data[c])));

        await cmd.ExecuteNonQueryAsync(ct);
    }

    private static async Task DeleteAsync(
        SqlConnection conn, SqlTransaction tx, SyncTable table, IReadOnlyList<object> key, CancellationToken ct)
    {
        var where = string.Join(" AND ", table.KeyColumns.Select((k, i) => $"[{k}] = @k{i}"));

        await using var cmd = conn.CreateCommand();
        cmd.Transaction = tx;
        cmd.CommandText = $"DELETE FROM {table.Qualified} WHERE {where}";
        for (var i = 0; i < key.Count; i++)
            cmd.Parameters.Add(new SqlParameter($"@k{i}", Normalise(key[i])));

        // Deleting a row that is already gone is a success, not a failure - the batch may be a
        // replay, and the desired end state is the same either way.
        await cmd.ExecuteNonQueryAsync(ct);
    }

    // ── Deferred rows ─────────────────────────────────────────────────────────

    private static async Task DeferAsync(
        SqlConnection conn, SqlTransaction tx, Guid tenantId, SyncTable table,
        SyncRowDto row, string error, CancellationToken ct)
    {
        var keyJson = JsonSerializer.Serialize(row.Key.Select(k => k?.ToString()));
        var payload = JsonSerializer.Serialize(row);

        await using var cmd = conn.CreateCommand();
        cmd.Transaction = tx;
        cmd.CommandText = $"""
            UPDATE {DeferredRows}
            SET    Payload = @p, Attempts = Attempts + 1, LastError = @e, DeferredAt = SYSUTCDATETIME()
            WHERE  TenantId = @t AND TableName = @n AND KeyJson = @k;

            IF @@ROWCOUNT = 0
                INSERT INTO {DeferredRows} (TenantId, TableName, KeyJson, Payload, Attempts, LastError)
                VALUES (@t, @n, @k, @p, 1, @e);
            """;
        cmd.Parameters.Add(new SqlParameter("@t", tenantId));
        cmd.Parameters.Add(new SqlParameter("@n", table.Name));
        cmd.Parameters.Add(new SqlParameter("@k", keyJson));
        cmd.Parameters.Add(new SqlParameter("@p", payload));
        cmd.Parameters.Add(new SqlParameter("@e", Truncate(error, 2000)));
        await cmd.ExecuteNonQueryAsync(ct);
    }

    /// <summary>
    /// A row whose parent never arrives is not a transient problem, and retrying it every night
    /// forever turns the queue into a permanent, growing cost. After this many attempts it stops
    /// being drained and is reported instead.
    ///
    /// <para>
    /// The case that produces them: a child table with no <c>TenantId</c> column of its own - the
    /// identity join tables, audit logs - is pushed whole, while its parent rows ARE tenant-filtered.
    /// On a single-workspace installation, which is the only supported on-premises shape, every
    /// parent belongs to that workspace and nothing defers. On a box that holds several workspaces
    /// the surplus children can never land, and this is what stops them being retried forever.
    /// </para>
    /// </summary>
    private const int MaxDeferredAttempts = 5;

    /// <summary>
    /// Retries rows held from earlier batches. Only rows for the table currently being pushed are
    /// attempted, because that is the one whose parents may just have landed - draining every table
    /// on every batch would turn each push into a full re-scan of the queue.
    /// </summary>
    private async Task<(int Applied, int StillDeferred)> DrainDeferredAsync(
        SqlConnection conn, Guid tenantId, IReadOnlyList<SyncTable> catalogue,
        IReadOnlyDictionary<string, ColumnInfo> columns, SyncTable table, CancellationToken ct)
    {
        var held = new List<(long Id, SyncRowDto Row)>();

        await using (var read = conn.CreateCommand())
        {
            read.CommandText =
                $"SELECT TOP (500) Id, Payload FROM {DeferredRows} " +
                "WHERE TenantId = @t AND TableName = @n AND Attempts < @max ORDER BY Id";
            read.Parameters.Add(new SqlParameter("@t", tenantId));
            read.Parameters.Add(new SqlParameter("@n", table.Name));
            read.Parameters.Add(new SqlParameter("@max", MaxDeferredAttempts));

            await using var reader = await read.ExecuteReaderAsync(ct);
            while (await reader.ReadAsync(ct))
            {
                var row = JsonSerializer.Deserialize<SyncRowDto>(reader.GetString(1));
                if (row is not null) held.Add((reader.GetInt64(0), row));
            }
        }

        if (held.Count == 0) return (0, 0);

        var applied = 0;
        var stuck   = 0;

        await using var tx = (SqlTransaction)await conn.BeginTransactionAsync(ct);
        foreach (var (id, row) in held)
        {
            var outcome = await ApplyRowAsync(conn, tx, table, columns, tenantId, row, ct);
            if (outcome.Kind == RowOutcome.Applied)
            {
                await using var del = conn.CreateCommand();
                del.Transaction = tx;
                del.CommandText = $"DELETE FROM {DeferredRows} WHERE Id = @id";
                del.Parameters.Add(new SqlParameter("@id", id));
                await del.ExecuteNonQueryAsync(ct);
                applied++;
            }
            else stuck++;
        }
        await tx.CommitAsync(ct);

        if (applied > 0)
            logger.LogInformation("Sync: {Table} - {Applied} previously deferred row(s) placed.", table.Name, applied);

        await ReportAbandonedAsync(conn, tenantId, table, ct);
        return (applied, stuck);
    }

    /// <summary>
    /// Whether a batch already landed. Answers the sender's "did you get it?" after a timeout, where
    /// it cannot tell a lost request from a lost response.
    /// </summary>
    public async Task<bool> WasBatchAppliedAsync(Guid batchId, Guid tenantId, CancellationToken ct = default)
    {
        await using var conn = await OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = $"SELECT COUNT(*) FROM {BatchLedger} WHERE BatchId = @b AND TenantId = @t";
        cmd.Parameters.Add(new SqlParameter("@b", batchId));
        cmd.Parameters.Add(new SqlParameter("@t", tenantId));
        return Convert.ToInt32(await cmd.ExecuteScalarAsync(ct)) > 0;
    }

    /// <summary>
    /// Says once per run when a table is holding rows that have stopped being retried, so they are
    /// visible rather than silently accumulating. Kept, not deleted: they are evidence of a parent
    /// that should have been sent, and deleting them would erase the only trace.
    /// </summary>
    private async Task ReportAbandonedAsync(
        SqlConnection conn, Guid tenantId, SyncTable table, CancellationToken ct)
    {
        await using var cmd = conn.CreateCommand();
        cmd.CommandText =
            $"SELECT COUNT(*) FROM {DeferredRows} WHERE TenantId = @t AND TableName = @n AND Attempts >= @max";
        cmd.Parameters.Add(new SqlParameter("@t", tenantId));
        cmd.Parameters.Add(new SqlParameter("@n", table.Name));
        cmd.Parameters.Add(new SqlParameter("@max", MaxDeferredAttempts));

        var abandoned = Convert.ToInt32(await cmd.ExecuteScalarAsync(ct));
        if (abandoned > 0)
            logger.LogWarning(
                "Sync: {Table} is holding {Count} row(s) whose parent never arrived after {Attempts} " +
                "attempts; they are no longer retried. This normally means the parent row belongs to a " +
                "workspace this installation does not push.",
                table.Name, abandoned, MaxDeferredAttempts);
    }

    // ── Ledger ────────────────────────────────────────────────────────────────

    private static async Task<bool> BatchAlreadyAppliedAsync(SqlConnection conn, Guid batchId, CancellationToken ct)
    {
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = $"SELECT COUNT(*) FROM {BatchLedger} WHERE BatchId = @b";
        cmd.Parameters.Add(new SqlParameter("@b", batchId));
        return Convert.ToInt32(await cmd.ExecuteScalarAsync(ct)) > 0;
    }

    private static async Task RecordBatchAsync(
        SqlConnection conn, SqlTransaction tx, SyncPushRequest request, int applied, CancellationToken ct)
    {
        await using var cmd = conn.CreateCommand();
        cmd.Transaction = tx;
        cmd.CommandText =
            $"INSERT INTO {BatchLedger} (BatchId, TenantId, TableName, RowCount_, ToVersion) " +
            "VALUES (@b, @t, @n, @c, @v)";
        cmd.Parameters.Add(new SqlParameter("@b", request.BatchId));
        cmd.Parameters.Add(new SqlParameter("@t", request.TenantId));
        cmd.Parameters.Add(new SqlParameter("@n", request.TableName));
        cmd.Parameters.Add(new SqlParameter("@c", applied));
        cmd.Parameters.Add(new SqlParameter("@v", request.ToVersion));
        await cmd.ExecuteNonQueryAsync(ct);
    }

    // ── Schema ────────────────────────────────────────────────────────────────

    private sealed record ColumnInfo(string Name, bool IsWritable);

    /// <summary>
    /// The table's columns, flagging the ones that cannot be written: computed columns and
    /// <c>rowversion</c>. Attempting either is an error from SQL Server, and they are derived on
    /// this side anyway.
    /// </summary>
    private static async Task<IReadOnlyDictionary<string, ColumnInfo>> ReadWritableColumnsAsync(
        SqlConnection conn, SyncTable table, CancellationToken ct)
    {
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = """
            SELECT c.name, c.is_computed, t.name AS TypeName
            FROM   sys.columns c
            JOIN   sys.types   t ON t.user_type_id = c.user_type_id
            WHERE  c.object_id = OBJECT_ID(@t)
            """;
        cmd.Parameters.Add(new SqlParameter("@t", table.Name));

        var map = new Dictionary<string, ColumnInfo>(StringComparer.OrdinalIgnoreCase);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            var name     = reader.GetString(0);
            var computed = reader.GetBoolean(1);
            var type     = reader.GetString(2);
            var writable = !computed && !type.Equals("timestamp", StringComparison.OrdinalIgnoreCase)
                                     && !type.Equals("rowversion", StringComparison.OrdinalIgnoreCase);
            map[name] = new ColumnInfo(name, writable);
        }
        return map;
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private static bool IsForeignKeyViolation(SqlException ex) =>
        ex.Number is 547;   // constraint violation; FK is by far the common case here

    private static SyncPushResponse Reject(SyncPushRequest request, string error) =>
        new(request.BatchId, 0, 0, request.Rows.Count, false, [error]);

    /// <summary>
    /// JSON round-tripping turns values into <see cref="JsonElement"/>. Unwrap to the CLR types
    /// SqlClient understands, and map null to <see cref="DBNull"/> - passing a CLR null to a
    /// parameter silently omits it rather than writing NULL.
    /// </summary>
    private static object Normalise(object? value) => value switch
    {
        null                       => DBNull.Value,
        JsonElement e              => NormaliseJson(e),
        _                          => value,
    };

    private static object NormaliseJson(JsonElement e) => e.ValueKind switch
    {
        JsonValueKind.Null or JsonValueKind.Undefined => DBNull.Value,
        JsonValueKind.True                            => true,
        JsonValueKind.False                           => false,
        JsonValueKind.Number when e.TryGetInt64(out var l)    => l,
        JsonValueKind.Number when e.TryGetDecimal(out var d)  => d,
        JsonValueKind.Number                                  => e.GetDouble(),
        JsonValueKind.String when e.TryGetGuid(out var g)     => g,
        JsonValueKind.String when e.TryGetDateTime(out var dt) => dt,
        JsonValueKind.String                                  => e.GetString() ?? (object)DBNull.Value,
        _                                                     => e.GetRawText(),
    };

    private static string Truncate(string s, int max) => s.Length <= max ? s : s[..max];

    private async Task<SqlConnection> OpenAsync(CancellationToken ct)
    {
        var conn = new SqlConnection(connectionString);
        await conn.OpenAsync(ct);
        return conn;
    }
}
