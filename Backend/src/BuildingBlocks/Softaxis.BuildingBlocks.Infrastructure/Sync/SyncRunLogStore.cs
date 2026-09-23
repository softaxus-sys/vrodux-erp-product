using Microsoft.Data.SqlClient;

namespace Softaxis.BuildingBlocks.Infrastructure.Sync;

/// <summary>One recorded attempt.</summary>
public sealed record SyncRunLogEntry(
    long      Id,
    DateTime  StartedAt,
    DateTime? FinishedAt,
    string    Trigger,
    bool      Ran,
    bool      Succeeded,
    int       TablesProcessed,
    int       TablesFailed,
    int       RowsSent,
    string?   Message);

/// <summary>
/// A history of runs, so "when did this start going wrong?" has an answer.
///
/// <para>
/// The settings row already carries the current state - last success, consecutive failures, last
/// error - but current state cannot answer that question. After a bad night the first thing anyone
/// needs is whether last night was the first bad one or the fifth.
/// </para>
///
/// <para>
/// Capped at the most recent 200 rows. This is diagnostic, not an audit trail: a shop that syncs
/// nightly for three years should not accumulate a thousand rows nobody will read.
/// </para>
/// </summary>
public sealed class SyncRunLogStore(string connectionString)
{
    private const string Table = "[sync].[run_log]";
    private const int    Keep  = 200;

    public async Task EnsureCreatedAsync(CancellationToken ct = default)
    {
        const string sql = $"""
            IF SCHEMA_ID('sync') IS NULL EXEC('CREATE SCHEMA [sync]');

            IF OBJECT_ID('{Table}') IS NULL
            CREATE TABLE {Table}
            (
                Id              BIGINT IDENTITY(1,1) CONSTRAINT PK_sync_run_log PRIMARY KEY,
                StartedAt       DATETIME2      NOT NULL,
                FinishedAt      DATETIME2      NULL,
                Trigger_        NVARCHAR(20)   NOT NULL,
                Ran             BIT            NOT NULL,
                Succeeded       BIT            NOT NULL,
                TablesProcessed INT            NOT NULL,
                TablesFailed    INT            NOT NULL,
                RowsSent        INT            NOT NULL,
                Message         NVARCHAR(2000) NULL
            );
            """;

        await using var conn = await OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = sql;
        await cmd.ExecuteNonQueryAsync(ct);
    }

    /// <summary>
    /// Opens a row when the run starts, not when it finishes. A run that crashes or is killed
    /// mid-way then leaves an unfinished row saying so, rather than leaving no trace at all - which
    /// would read as "it never ran" and send the reader looking in the wrong place.
    /// </summary>
    public async Task<long> StartAsync(string trigger, CancellationToken ct = default)
    {
        await EnsureCreatedAsync(ct);

        await using var conn = await OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText =
            $"INSERT INTO {Table} (StartedAt, Trigger_, Ran, Succeeded, TablesProcessed, TablesFailed, RowsSent) " +
            "OUTPUT INSERTED.Id VALUES (SYSUTCDATETIME(), @trigger, 0, 0, 0, 0, 0)";
        cmd.Parameters.Add(new SqlParameter("@trigger", trigger));

        var id = Convert.ToInt64(await cmd.ExecuteScalarAsync(ct));
        await TrimAsync(conn, ct);
        return id;
    }

    public async Task FinishAsync(
        long id, bool ran, bool succeeded, int tables, int failed, int rows, string? message,
        CancellationToken ct = default)
    {
        await using var conn = await OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = $"""
            UPDATE {Table}
            SET    FinishedAt = SYSUTCDATETIME(), Ran = @ran, Succeeded = @ok,
                   TablesProcessed = @tables, TablesFailed = @failed, RowsSent = @rows, Message = @msg
            WHERE  Id = @id
            """;
        cmd.Parameters.Add(new SqlParameter("@id", id));
        cmd.Parameters.Add(new SqlParameter("@ran", ran));
        cmd.Parameters.Add(new SqlParameter("@ok", succeeded));
        cmd.Parameters.Add(new SqlParameter("@tables", tables));
        cmd.Parameters.Add(new SqlParameter("@failed", failed));
        cmd.Parameters.Add(new SqlParameter("@rows", rows));
        cmd.Parameters.Add(new SqlParameter("@msg",
            (object?)(message is null ? null : message.Length > 2000 ? message[..2000] : message) ?? DBNull.Value));
        await cmd.ExecuteNonQueryAsync(ct);
    }

    public async Task<IReadOnlyList<SyncRunLogEntry>> RecentAsync(int take = 30, CancellationToken ct = default)
    {
        await EnsureCreatedAsync(ct);

        await using var conn = await OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText =
            $"SELECT TOP (@take) Id, StartedAt, FinishedAt, Trigger_, Ran, Succeeded, " +
            $"TablesProcessed, TablesFailed, RowsSent, Message FROM {Table} ORDER BY Id DESC";
        cmd.Parameters.Add(new SqlParameter("@take", take));

        var list = new List<SyncRunLogEntry>();
        await using var r = await cmd.ExecuteReaderAsync(ct);
        while (await r.ReadAsync(ct))
        {
            list.Add(new SyncRunLogEntry(
                r.GetInt64(0), r.GetDateTime(1),
                r.IsDBNull(2) ? null : r.GetDateTime(2),
                r.GetString(3), r.GetBoolean(4), r.GetBoolean(5),
                r.GetInt32(6), r.GetInt32(7), r.GetInt32(8),
                r.IsDBNull(9) ? null : r.GetString(9)));
        }
        return list;
    }

    private static async Task TrimAsync(SqlConnection conn, CancellationToken ct)
    {
        await using var cmd = conn.CreateCommand();
        cmd.CommandText =
            $"DELETE FROM {Table} WHERE Id <= (SELECT MIN(Id) FROM (SELECT TOP (@keep) Id FROM {Table} ORDER BY Id DESC) x) - 1";
        cmd.Parameters.Add(new SqlParameter("@keep", Keep));
        await cmd.ExecuteNonQueryAsync(ct);
    }

    private async Task<SqlConnection> OpenAsync(CancellationToken ct)
    {
        var conn = new SqlConnection(connectionString);
        await conn.OpenAsync(ct);
        return conn;
    }
}
