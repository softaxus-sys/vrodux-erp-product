using System.Collections.Concurrent;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Data.SqlClient;

namespace Softaxis.BuildingBlocks.Infrastructure.Sync.Branch;

/// <summary>One issued branch key, as head office can see it (never the key itself).</summary>
public sealed record BranchKeyInfo(Guid Id, Guid BranchId, Guid TenantId, string Hint, DateTime CreatedAt,
    string? CreatedByName, DateTime? LastUsedAt, DateTime? RevokedAt);

/// <summary>
/// On the cloud: branch keys issued from the head-office screen. Only a SHA-256 hash is stored - the key is
/// shown once when issued, then exists only in the branch server's settings.
///
/// <para>
/// <b>Rotation without downtime.</b> Issuing a new key leaves the old one working, so the branch keeps
/// syncing while the new key is entered there. The first time the branch connects with the new key, every
/// older key for that branch is revoked automatically. "Revoke all" cuts a branch off at once (stolen PC).
/// </para>
/// Keys listed in configuration (<c>BranchSync:Branches</c>) still work alongside these.
/// </summary>
public sealed class BranchKeyStore(string connectionString)
{
    private const string Qualified = "[sync].[branch_keys]";
    private static readonly TimeSpan CacheFor = TimeSpan.FromSeconds(30);
    private readonly ConcurrentDictionary<string, (BranchCredential? Cred, Guid KeyId, DateTime At)> _cache = new();
    private readonly ConcurrentDictionary<Guid, DateTime> _touched = new();

    public async Task EnsureCreatedAsync(CancellationToken ct = default)
    {
        const string sql = $"""
            IF SCHEMA_ID('sync') IS NULL EXEC('CREATE SCHEMA [sync]');
            IF OBJECT_ID('{Qualified}') IS NULL
            BEGIN
                CREATE TABLE {Qualified}
                (
                    Id            UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_sync_branch_keys PRIMARY KEY,
                    BranchId      UNIQUEIDENTIFIER NOT NULL,
                    TenantId      UNIQUEIDENTIFIER NOT NULL,
                    KeyHash       NVARCHAR(100)    NOT NULL,
                    Hint          NVARCHAR(10)     NOT NULL,
                    CreatedAt     DATETIME2        NOT NULL,
                    CreatedByName NVARCHAR(200)    NULL,
                    LastUsedAt    DATETIME2        NULL,
                    RevokedAt     DATETIME2        NULL
                );
                CREATE UNIQUE INDEX UX_sync_branch_keys_hash ON {Qualified}(KeyHash);
                CREATE INDEX IX_sync_branch_keys_branch ON {Qualified}(BranchId);
            END;
            IF COL_LENGTH('{Qualified}', 'MachineId') IS NULL ALTER TABLE {Qualified} ADD MachineId NVARCHAR(100) NULL;
            """;
        await ExecAsync(sql, ct);
    }

    /// <summary>Creates a new key for the branch and returns it. It cannot be read back later.</summary>
    public async Task<string> IssueAsync(Guid branchId, Guid tenantId, string? createdBy, CancellationToken ct)
    {
        var raw = "vbk_" + Convert.ToBase64String(RandomNumberGenerator.GetBytes(32)).TrimEnd('=').Replace('+', '-').Replace('/', '_');
        await ExecAsync($"INSERT INTO {Qualified} (Id, BranchId, TenantId, KeyHash, Hint, CreatedAt, CreatedByName) VALUES (@i, @b, @t, @h, @x, SYSUTCDATETIME(), @n)", ct,
            P("@i", Guid.NewGuid()), P("@b", branchId), P("@t", tenantId), P("@h", Hash(raw)), P("@x", raw[^4..]), P("@n", createdBy));
        return raw;
    }

    /// <summary>Cuts the branch off: every key it holds stops working (within this server at once).</summary>
    public async Task<int> RevokeAllAsync(Guid branchId, CancellationToken ct)
    {
        var n = await ExecAsync($"UPDATE {Qualified} SET RevokedAt = SYSUTCDATETIME() WHERE BranchId = @b AND RevokedAt IS NULL", ct, P("@b", branchId));
        foreach (var k in _cache.Where(e => e.Value.Cred?.BranchId == branchId).Select(e => e.Key).ToList()) _cache.TryRemove(k, out _);
        return n;
    }

    /// <summary>
    /// The credential for a branch id + presented key, or null. Uses the key, revoking older ones on first use.
    /// <para>
    /// A key works on <b>one PC only</b>: the first machine that uses it is recorded, and any other machine
    /// presenting the same key is refused. A replacement PC needs a new key. A server that sends no machine id
    /// (an older build) is accepted only while the key is still unbound.
    /// </para>
    /// </summary>
    public async Task<BranchCredential?> AuthenticateAsync(Guid branchId, string rawKey, string? machineId, CancellationToken ct)
    {
        var hash = Hash(rawKey);
        machineId = string.IsNullOrWhiteSpace(machineId) ? null : machineId.Trim();
        var cacheKey = branchId + ":" + hash + ":" + machineId;
        if (_cache.TryGetValue(cacheKey, out var hit) && DateTime.UtcNow - hit.At < CacheFor)
            return hit.Cred;

        BranchCredential? cred = null; Guid keyId = Guid.Empty; DateTime createdAt = default; DateTime? lastUsed = null; string? boundTo = null;
        await using (var conn = await OpenAsync(ct))
        await using (var cmd = conn.CreateCommand())
        {
            cmd.CommandText = $"SELECT Id, TenantId, CreatedAt, LastUsedAt, MachineId FROM {Qualified} WHERE KeyHash = @h AND BranchId = @b AND RevokedAt IS NULL";
            cmd.Parameters.Add(P("@h", hash)); cmd.Parameters.Add(P("@b", branchId));
            await using var r = await cmd.ExecuteReaderAsync(ct);
            if (await r.ReadAsync(ct))
            {
                keyId = r.GetGuid(0);
                cred = new BranchCredential { BranchId = branchId, TenantId = r.GetGuid(1), Key = rawKey };
                createdAt = r.GetDateTime(2);
                lastUsed = r.IsDBNull(3) ? null : r.GetDateTime(3);
                boundTo = r.IsDBNull(4) ? null : r.GetString(4);
            }
        }

        if (cred is not null)
        {
            if (boundTo is null && machineId is not null)
            {
                // First use: claim the key for this PC. Conditional, so two PCs racing cannot both win.
                var claimed = await ExecAsync($"UPDATE {Qualified} SET MachineId = @m WHERE Id = @i AND MachineId IS NULL", ct, P("@m", machineId), P("@i", keyId));
                if (claimed == 0) boundTo = await ReadMachineAsync(keyId, ct);
                else boundTo = machineId;
            }
            // Bound to a different PC, or bound while this caller identifies no machine: refuse.
            if (boundTo is not null && !string.Equals(boundTo, machineId, StringComparison.Ordinal))
                cred = null;
        }

        if (cred is not null)
        {
            // First use of a newer key: the old ones are no longer needed.
            if (lastUsed is null)
                await ExecAsync($"UPDATE {Qualified} SET RevokedAt = SYSUTCDATETIME() WHERE BranchId = @b AND RevokedAt IS NULL AND Id <> @i AND CreatedAt < @c", ct,
                    P("@b", branchId), P("@i", keyId), P("@c", createdAt));
            if (!_touched.TryGetValue(keyId, out var t) || DateTime.UtcNow - t > TimeSpan.FromMinutes(1))
            {
                _touched[keyId] = DateTime.UtcNow;
                await ExecAsync($"UPDATE {Qualified} SET LastUsedAt = SYSUTCDATETIME() WHERE Id = @i", ct, P("@i", keyId));
            }
            // Drop cached entries for the branch's other (now revoked) keys.
            foreach (var k in _cache.Where(e => e.Value.Cred?.BranchId == branchId && e.Value.KeyId != keyId).Select(e => e.Key).ToList())
                _cache.TryRemove(k, out _);
        }
        _cache[cacheKey] = (cred, keyId, DateTime.UtcNow);
        return cred;
    }

    private async Task<string?> ReadMachineAsync(Guid keyId, CancellationToken ct)
    {
        await using var conn = await OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = $"SELECT MachineId FROM {Qualified} WHERE Id = @i";
        cmd.Parameters.Add(P("@i", keyId));
        return await cmd.ExecuteScalarAsync(ct) as string;
    }

    public async Task<IReadOnlyList<BranchKeyInfo>> ListAsync(Guid? tenantId, bool activeOnly, CancellationToken ct)
    {
        await using var conn = await OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = $"""
            SELECT Id, BranchId, TenantId, Hint, CreatedAt, CreatedByName, LastUsedAt, RevokedAt FROM {Qualified}
            WHERE (@t IS NULL OR TenantId = @t) AND (@a = 0 OR RevokedAt IS NULL) ORDER BY CreatedAt DESC
            """;
        cmd.Parameters.Add(new SqlParameter("@t", System.Data.SqlDbType.UniqueIdentifier) { Value = (object?)tenantId ?? DBNull.Value });
        cmd.Parameters.Add(P("@a", activeOnly ? 1 : 0));
        var list = new List<BranchKeyInfo>();
        await using var r = await cmd.ExecuteReaderAsync(ct);
        while (await r.ReadAsync(ct))
            list.Add(new BranchKeyInfo(r.GetGuid(0), r.GetGuid(1), r.GetGuid(2), r.GetString(3), r.GetDateTime(4),
                r.IsDBNull(5) ? null : r.GetString(5), r.IsDBNull(6) ? null : r.GetDateTime(6), r.IsDBNull(7) ? null : r.GetDateTime(7)));
        return list;
    }

    /// <summary>
    /// What an installer needs to join a branch to head office, in one pastable string:
    /// <c>VBR1.</c> + base64url of {u: cloud address, t: workspace, b: branch, k: key, m: subscribed modules}.
    /// </summary>
    public static string ConnectionCode(string cloudBaseUrl, Guid tenantId, Guid branchId, string key, string? modules = null)
    {
        var json = JsonSerializer.Serialize(new { u = cloudBaseUrl.TrimEnd('/'), t = tenantId, b = branchId, k = key, m = string.IsNullOrWhiteSpace(modules) ? null : modules });
        return "VBR1." + Convert.ToBase64String(Encoding.UTF8.GetBytes(json)).TrimEnd('=').Replace('+', '-').Replace('/', '_');
    }

    private static string Hash(string raw) => Convert.ToBase64String(SHA256.HashData(Encoding.UTF8.GetBytes(raw)));
    private static SqlParameter P(string name, object? value) => new(name, value ?? DBNull.Value);

    private async Task<int> ExecAsync(string sql, CancellationToken ct, params SqlParameter[] ps)
    {
        await using var conn = await OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = sql;
        cmd.Parameters.AddRange(ps);
        return await cmd.ExecuteNonQueryAsync(ct);
    }

    private async Task<SqlConnection> OpenAsync(CancellationToken ct)
    {
        var conn = new SqlConnection(connectionString);
        await conn.OpenAsync(ct);
        return conn;
    }
}
