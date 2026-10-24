using Microsoft.Data.SqlClient;

namespace Softaxis.BuildingBlocks.Infrastructure.Sync.Branch;

/// <summary>One branch server as head office last saw it.</summary>
public sealed record BranchStatusRow(
    Guid      BranchId,
    Guid      TenantId,
    DateTime? LastHeartbeatAt,
    string?   Version,
    int?      ClockDriftSeconds,
    DateTime? LastUpOkAt,
    DateTime? LastDownOkAt,
    string?   LastError,
    int       ConsecutiveFailures,
    DateTime? FailingSince,
    long      UpRowsTotal,
    long      DownRowsTotal,
    DateTime? OfflineAlertAt);

/// <summary>
/// On the cloud: the latest heartbeat from each branch server, plus whether head office has been told it went
/// silent. Survives a restart (unlike <see cref="BranchPresence"/>), so a branch that dies while the cloud is
/// restarting is still noticed. Raw SQL in schema <c>sync</c>, same reasoning as <see cref="SyncStateStore"/>.
/// </summary>
public sealed class BranchStatusStore(string connectionString)
{
    private const string Qualified = "[sync].[branch_status]";

    public async Task EnsureCreatedAsync(CancellationToken ct = default)
    {
        const string sql = $"""
            IF SCHEMA_ID('sync') IS NULL EXEC('CREATE SCHEMA [sync]');
            IF OBJECT_ID('{Qualified}') IS NULL
            CREATE TABLE {Qualified}
            (
                BranchId            UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_sync_branch_status PRIMARY KEY,
                TenantId            UNIQUEIDENTIFIER NOT NULL,
                LastHeartbeatAt     DATETIME2      NULL,
                Version             NVARCHAR(100)  NULL,
                ClockDriftSeconds   INT            NULL,
                LastUpOkAt          DATETIME2      NULL,
                LastDownOkAt        DATETIME2      NULL,
                LastError           NVARCHAR(1000) NULL,
                ConsecutiveFailures INT            NOT NULL CONSTRAINT DF_sync_bs_fail DEFAULT(0),
                FailingSince        DATETIME2      NULL,
                UpRowsTotal         BIGINT         NOT NULL CONSTRAINT DF_sync_bs_up DEFAULT(0),
                DownRowsTotal       BIGINT         NOT NULL CONSTRAINT DF_sync_bs_down DEFAULT(0),
                OfflineAlertAt      DATETIME2      NULL
            );
            """;
        await ExecAsync(sql, ct);
    }

    public Task RecordHeartbeatAsync(Guid branchId, Guid tenantId, BranchHeartbeat h, int driftSeconds, CancellationToken ct)
    {
        var error = h.LastError is { Length: > 1000 } e ? e[..1000] : h.LastError;
        return ExecAsync($"""
            MERGE {Qualified} AS t
            USING (SELECT @b AS BranchId) AS s ON t.BranchId = s.BranchId
            WHEN MATCHED THEN UPDATE SET TenantId=@t, LastHeartbeatAt=SYSUTCDATETIME(), Version=@v, ClockDriftSeconds=@d,
                LastUpOkAt=@up, LastDownOkAt=@down, LastError=@err, ConsecutiveFailures=@f, FailingSince=@fs,
                UpRowsTotal=@ur, DownRowsTotal=@dr
            WHEN NOT MATCHED THEN INSERT (BranchId, TenantId, LastHeartbeatAt, Version, ClockDriftSeconds, LastUpOkAt, LastDownOkAt,
                LastError, ConsecutiveFailures, FailingSince, UpRowsTotal, DownRowsTotal)
                VALUES (@b, @t, SYSUTCDATETIME(), @v, @d, @up, @down, @err, @f, @fs, @ur, @dr);
            """, ct,
            P("@b", branchId), P("@t", tenantId), P("@v", Trim(h.Version, 100)), P("@d", driftSeconds),
            P("@up", h.LastUpOkAt), P("@down", h.LastDownOkAt), P("@err", error), P("@f", h.ConsecutiveFailures),
            P("@fs", h.FailingSince), P("@ur", (long)h.UpRowsTotal), P("@dr", (long)h.DownRowsTotal));
    }

    /// <summary>Marks (or clears, with null) that head office was told the branch went silent.</summary>
    public Task SetOfflineAlertAsync(Guid branchId, Guid tenantId, DateTime? at, CancellationToken ct) =>
        ExecAsync($"""
            MERGE {Qualified} AS t
            USING (SELECT @b AS BranchId) AS s ON t.BranchId = s.BranchId
            WHEN MATCHED THEN UPDATE SET OfflineAlertAt=@a
            WHEN NOT MATCHED THEN INSERT (BranchId, TenantId, OfflineAlertAt) VALUES (@b, @t, @a);
            """, ct, P("@b", branchId), P("@t", tenantId), P("@a", at));

    public async Task<IReadOnlyList<BranchStatusRow>> ReadAsync(Guid? tenantId, CancellationToken ct = default)
    {
        await using var conn = await OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = $"""
            SELECT BranchId, TenantId, LastHeartbeatAt, Version, ClockDriftSeconds, LastUpOkAt, LastDownOkAt, LastError,
                   ConsecutiveFailures, FailingSince, UpRowsTotal, DownRowsTotal, OfflineAlertAt
            FROM {Qualified} WHERE @t IS NULL OR TenantId = @t
            """;
        cmd.Parameters.Add(new SqlParameter("@t", System.Data.SqlDbType.UniqueIdentifier) { Value = (object?)tenantId ?? DBNull.Value });
        var list = new List<BranchStatusRow>();
        await using var r = await cmd.ExecuteReaderAsync(ct);
        while (await r.ReadAsync(ct))
            list.Add(new BranchStatusRow(
                r.GetGuid(0), r.GetGuid(1), N<DateTime>(r, 2), r.IsDBNull(3) ? null : r.GetString(3), N<int>(r, 4),
                N<DateTime>(r, 5), N<DateTime>(r, 6), r.IsDBNull(7) ? null : r.GetString(7), r.GetInt32(8),
                N<DateTime>(r, 9), r.GetInt64(10), r.GetInt64(11), N<DateTime>(r, 12)));
        return list;
    }

    private static T? N<T>(SqlDataReader r, int i) where T : struct => r.IsDBNull(i) ? null : r.GetFieldValue<T>(i);
    private static string? Trim(string? s, int max) => s is { Length: > 0 } && s.Length > max ? s[..max] : s;
    private static SqlParameter P(string name, object? value) => new(name, value ?? DBNull.Value);

    private async Task ExecAsync(string sql, CancellationToken ct, params SqlParameter[] ps)
    {
        await using var conn = await OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = sql;
        cmd.Parameters.AddRange(ps);
        await cmd.ExecuteNonQueryAsync(ct);
    }

    private async Task<SqlConnection> OpenAsync(CancellationToken ct)
    {
        var conn = new SqlConnection(connectionString);
        await conn.OpenAsync(ct);
        return conn;
    }
}
