using Microsoft.Data.SqlClient;

namespace Softaxis.BuildingBlocks.Infrastructure.Sync;

/// <summary>This installation's cloud-mirror push configuration, plus how the last run went.</summary>
public sealed record SyncSettings(
    Guid      TenantId,
    bool      Enabled,
    string    CloudBaseUrl,
    string    RunAtLocalTime,
    string    TimeZoneId,
    DateTime? LastAttemptAt,
    DateTime? LastSuccessAt,
    int       ConsecutiveFailures,
    string?   LastError,
    bool      ReseedRequired)
{
    /// <summary>
    /// Usable only when it is switched on AND has somewhere to push. A half-configured row must
    /// never look ready, or the scheduler burns a nightly window failing on a blank URL.
    /// </summary>
    public bool IsRunnable => Enabled && !string.IsNullOrWhiteSpace(CloudBaseUrl);

    /// <summary>The configured run time as a local time of day, or 23:30 if it is unparseable.</summary>
    public TimeSpan RunAt =>
        TimeSpan.TryParseExact(RunAtLocalTime, @"hh\:mm", null, out var t) ? t : new TimeSpan(23, 30, 0);

    /// <summary>
    /// The site's time zone, falling back to UTC rather than throwing. A bad id must not stop the
    /// service from starting - the update endpoint rejects one, so it can only get here by hand.
    /// </summary>
    public TimeZoneInfo Zone
    {
        get
        {
            try { return TimeZoneInfo.FindSystemTimeZoneById(TimeZoneId); }
            catch { return TimeZoneInfo.Utc; }
        }
    }
}

/// <summary>
/// Reads and writes <c>[identity].[tenant_sync_settings]</c> directly.
///
/// <para>
/// Raw SQL rather than Identity's DbContext because this lives in BuildingBlocks, which every
/// service depends on and which therefore cannot depend on Identity. Same arrangement as
/// <see cref="SyncStateStore"/> and <see cref="MirrorAwareTenantWorkFilter"/>, and every service's
/// connection string points at the same physical database.
/// </para>
///
/// <para>
/// <c>identity</c> is a reserved SQL Server keyword and MUST stay bracketed.
/// </para>
/// </summary>
public sealed class SyncSettingsStore(string connectionString)
{
    private const string Table = "[identity].[tenant_sync_settings]";

    /// <summary>
    /// The one configured installation, or null when the table is absent or holds no enabled row.
    /// Absent is a normal answer on a cloud deployment, not an error.
    /// </summary>
    public async Task<SyncSettings?> GetAsync(CancellationToken ct = default)
    {
        const string sql = $"""
            IF OBJECT_ID('{Table}') IS NULL SELECT TOP 0 CAST(NULL AS UNIQUEIDENTIFIER) AS TenantId
            ELSE
            SELECT TOP 1 [TenantId],[Enabled],[CloudBaseUrl],[RunAtLocalTime],[TimeZoneId],
                         [LastAttemptAt],[LastSuccessAt],[ConsecutiveFailures],[LastError],[ReseedRequired]
            FROM   {Table}
            WHERE  [IsDeleted] = 0
            ORDER  BY [CreatedAt];
            """;

        await using var conn = await OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = sql;

        await using var r = await cmd.ExecuteReaderAsync(ct);
        if (!await r.ReadAsync(ct)) return null;
        if (r.FieldCount < 10) return null;    // the "table absent" shape above

        return new SyncSettings(
            r.GetGuid(0), r.GetBoolean(1), r.GetString(2), r.GetString(3), r.GetString(4),
            r.IsDBNull(5) ? null : r.GetDateTime(5),
            r.IsDBNull(6) ? null : r.GetDateTime(6),
            r.GetInt32(7),
            r.IsDBNull(8) ? null : r.GetString(8),
            r.GetBoolean(9));
    }

    /// <summary>
    /// Creates or updates the installation's configuration. Keyed on the tenant, so a second call
    /// edits the same row rather than adding a rival schedule pushing the same data elsewhere.
    /// </summary>
    public async Task SaveAsync(
        Guid tenantId, bool enabled, string cloudBaseUrl, string runAtLocalTime, string timeZoneId,
        CancellationToken ct = default)
    {
        const string sql = $"""
            IF NOT EXISTS (SELECT 1 FROM {Table} WHERE [TenantId] = @tenant AND [IsDeleted] = 0)
                INSERT INTO {Table}
                    ([Id],[TenantId],[Enabled],[CloudBaseUrl],[RunAtLocalTime],[TimeZoneId],
                     [ConsecutiveFailures],[ReseedRequired],[CreatedAt],[CreatedBy],[IsDeleted])
                VALUES
                    (NEWID(), @tenant, @enabled, @url, @time, @zone, 0, 0, SYSUTCDATETIME(), 'sync', 0);
            ELSE
                UPDATE {Table}
                SET    [Enabled] = @enabled, [CloudBaseUrl] = @url,
                       [RunAtLocalTime] = @time, [TimeZoneId] = @zone,
                       [UpdatedAt] = SYSUTCDATETIME()
                WHERE  [TenantId] = @tenant AND [IsDeleted] = 0;
            """;

        await using var conn = await OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = sql;
        cmd.Parameters.Add(new SqlParameter("@tenant", tenantId));
        cmd.Parameters.Add(new SqlParameter("@enabled", enabled));
        cmd.Parameters.Add(new SqlParameter("@url", (cloudBaseUrl ?? string.Empty).Trim().TrimEnd('/')));
        cmd.Parameters.Add(new SqlParameter("@time", runAtLocalTime));
        cmd.Parameters.Add(new SqlParameter("@zone", timeZoneId));
        await cmd.ExecuteNonQueryAsync(ct);
    }

    /// <summary>
    /// Seeds the row from install-time configuration, but ONLY when none exists. A later edit made
    /// on the Cloud Sync screen must never be reverted by a service restart, or the screen would be
    /// pointless. Returns true when it actually created one.
    /// </summary>
    public async Task<bool> SeedIfAbsentAsync(
        Guid tenantId, bool enabled, string cloudBaseUrl, string runAtLocalTime, string timeZoneId,
        CancellationToken ct = default)
    {
        await using var conn = await OpenAsync(ct);

        await using (var probe = conn.CreateCommand())
        {
            probe.CommandText = $"SELECT COUNT(*) FROM {Table} WHERE [IsDeleted] = 0";
            if (Convert.ToInt32(await probe.ExecuteScalarAsync(ct)) > 0) return false;
        }

        await SaveAsync(tenantId, enabled, cloudBaseUrl, runAtLocalTime, timeZoneId, ct);
        return true;
    }

    public Task RecordAttemptAsync(Guid tenantId, CancellationToken ct = default) =>
        UpdateAsync(tenantId, "[LastAttemptAt] = SYSUTCDATETIME()", [], ct);

    public Task RecordSuccessAsync(Guid tenantId, CancellationToken ct = default) =>
        UpdateAsync(tenantId,
            "[LastSuccessAt] = SYSUTCDATETIME(), [ConsecutiveFailures] = 0, [LastError] = NULL", [], ct);

    /// <summary>
    /// Records a failed run. The message is kept whole (to 2000 chars) rather than summarised - the
    /// first question after an alert is what actually went wrong.
    /// </summary>
    public Task RecordFailureAsync(Guid tenantId, string error, CancellationToken ct = default) =>
        UpdateAsync(tenantId,
            "[ConsecutiveFailures] = [ConsecutiveFailures] + 1, [LastError] = @err",
            [new SqlParameter("@err", error.Length > 2000 ? error[..2000] : error)], ct);

    public Task SetReseedRequiredAsync(Guid tenantId, bool required, CancellationToken ct = default) =>
        UpdateAsync(tenantId, "[ReseedRequired] = @r", [new SqlParameter("@r", required)], ct);

    private async Task UpdateAsync(Guid tenantId, string set, SqlParameter[] extra, CancellationToken ct)
    {
        await using var conn = await OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = $"UPDATE {Table} SET {set}, [UpdatedAt] = SYSUTCDATETIME() " +
                          "WHERE [TenantId] = @tenant AND [IsDeleted] = 0";
        cmd.Parameters.Add(new SqlParameter("@tenant", tenantId));
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
