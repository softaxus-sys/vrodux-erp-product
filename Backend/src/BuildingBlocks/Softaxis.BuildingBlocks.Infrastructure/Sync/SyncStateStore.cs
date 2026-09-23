using Microsoft.Data.SqlClient;

namespace Softaxis.BuildingBlocks.Infrastructure.Sync;

/// <summary>Where a table's push has got to.</summary>
public sealed record SyncTableState(
    string    TableName,
    long?     LastSyncedVersion,
    DateTime? LastSyncedAt,
    bool      SeedCompleted,
    string?   SeedCursor);

/// <summary>
/// Per-table watermarks for the nightly push.
///
/// <para>
/// <b>Per table, not one global version.</b> A single global watermark means one failing table
/// blocks every other table's progress, and a partial run cannot be checkpointed at all.
/// </para>
///
/// <para>
/// Managed with raw SQL and created on startup rather than as an EF entity with a migration. This is
/// sync-engine bookkeeping that lives alongside - not inside - the business schemas, it is only ever
/// touched by this one class, and keeping it out of a DbContext avoids adding a BuildingBlocks
/// migration chain that every service would then carry.
/// </para>
/// </summary>
public sealed class SyncStateStore(string connectionString)
{
    public const string Schema = "sync";
    public const string Table  = "table_state";

    private const string Qualified = $"[{Schema}].[{Table}]";

    /// <summary>Creates the schema and table if absent. Idempotent; safe on every startup.</summary>
    public async Task EnsureCreatedAsync(CancellationToken ct = default)
    {
        const string sql = $"""
            IF SCHEMA_ID('{Schema}') IS NULL EXEC('CREATE SCHEMA [{Schema}]');

            IF OBJECT_ID('{Qualified}') IS NULL
            CREATE TABLE {Qualified}
            (
                TableName         NVARCHAR(256) NOT NULL CONSTRAINT PK_sync_table_state PRIMARY KEY,
                LastSyncedVersion BIGINT        NULL,
                LastSyncedAt      DATETIME2     NULL,
                SeedCompleted     BIT           NOT NULL CONSTRAINT DF_sync_seed_completed DEFAULT(0),
                SeedCursor        NVARCHAR(MAX) NULL
            );
            """;

        await using var conn = await OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = sql;
        await cmd.ExecuteNonQueryAsync(ct);
    }

    public async Task<IReadOnlyDictionary<string, SyncTableState>> ReadAllAsync(CancellationToken ct = default)
    {
        await using var conn = await OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText =
            $"SELECT TableName, LastSyncedVersion, LastSyncedAt, SeedCompleted, SeedCursor FROM {Qualified}";

        var map = new Dictionary<string, SyncTableState>(StringComparer.OrdinalIgnoreCase);
        await using var reader = await cmd.ExecuteReaderAsync(ct);
        while (await reader.ReadAsync(ct))
        {
            map[reader.GetString(0)] = new SyncTableState(
                reader.GetString(0),
                reader.IsDBNull(1) ? null : reader.GetInt64(1),
                reader.IsDBNull(2) ? null : reader.GetDateTime(2),
                reader.GetBoolean(3),
                reader.IsDBNull(4) ? null : reader.GetString(4));
        }
        return map;
    }

    /// <summary>
    /// Advances a table's watermark. The caller must only call this once a batch has actually
    /// landed: advancing optimistically turns a transient failure into permanently missing data.
    /// </summary>
    public Task SetVersionAsync(string tableName, long version, CancellationToken ct = default) =>
        UpsertAsync(tableName,
            "LastSyncedVersion = @v, LastSyncedAt = SYSUTCDATETIME(), SeedCompleted = 1, SeedCursor = NULL",
            [new SqlParameter("@v", version)], ct);

    /// <summary>Records seed progress so an interrupted initial export resumes instead of restarting.</summary>
    public Task SetSeedCursorAsync(string tableName, string? cursor, CancellationToken ct = default) =>
        UpsertAsync(tableName, "SeedCursor = @c", [new SqlParameter("@c", (object?)cursor ?? DBNull.Value)], ct);

    /// <summary>
    /// Clears a table's watermark, forcing a full reseed. Used when the stored version has aged past
    /// the retention window and Change Tracking can no longer say what changed.
    /// </summary>
    public Task ResetAsync(string tableName, CancellationToken ct = default) =>
        UpsertAsync(tableName,
            "LastSyncedVersion = NULL, SeedCompleted = 0, SeedCursor = NULL", [], ct);

    private async Task UpsertAsync(
        string tableName, string setClause, SqlParameter[] extra, CancellationToken ct)
    {
        // Insert-then-update, not MERGE: MERGE has a long history of concurrency surprises, and one
        // writer (the nightly push) makes the simple form perfectly safe. Doing the insert FIRST
        // means the update always finds its row, so a first-time write is never silently dropped.
        var sql = $"""
            IF NOT EXISTS (SELECT 1 FROM {Qualified} WHERE TableName = @t)
                INSERT INTO {Qualified} (TableName, SeedCompleted) VALUES (@t, 0);

            UPDATE {Qualified} SET {setClause} WHERE TableName = @t;
            """;

        await using var conn = await OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = sql;
        cmd.Parameters.Add(new SqlParameter("@t", tableName));
        cmd.Parameters.AddRange(extra);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    private async Task<SqlConnection> OpenAsync(CancellationToken ct)
    {
        var conn = new SqlConnection(connectionString);
        await conn.OpenAsync(ct);
        return conn;
    }
}
