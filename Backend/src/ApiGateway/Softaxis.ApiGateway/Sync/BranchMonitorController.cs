using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Options;
using Softaxis.BuildingBlocks.Infrastructure.Sync.Branch;

namespace Softaxis.ApiGateway.Sync;

/// <summary>
/// Head office's view of its branch servers: when each was last heard from, whether its last sync worked,
/// its version and clock, and what is waiting for it. Read-only. Active only on the cloud.
/// Needs <c>settings.branches.view</c>; a workspace sees only its own branches.
/// </summary>
[ApiController]
[Authorize]
[Route("api/sync/branches")]
public sealed class BranchMonitorController(
    IOptions<BranchSyncOptions> options, BranchStatusStore statusStore, BranchKeyStore keyStore, IConfiguration configuration) : ControllerBase
{
    private BranchSyncOptions O => options.Value;

    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        if (!O.IsCloud) return NotFound(new { error = "This server is not the head-office server for branch servers." });

        var superAdmin = User.FindFirst("is_super_admin")?.Value == "true";
        if (!superAdmin && !User.FindAll("permission").Any(c => c.Value == "settings.branches.view"))
            return StatusCode(StatusCodes.Status403Forbidden, new { code = "Permission.Denied", description = "Missing permission: settings.branches.view" });
        if (!Guid.TryParse(User.FindFirst("tenant_id")?.Value, out var tenantId))
            return Ok(Array.Empty<BranchServerStatusDto>());

        var rows = (await statusStore.ReadAsync(tenantId, ct)).ToDictionary(r => r.BranchId);
        var branches = await ReadBranchesAsync(tenantId, ct);
        var activeKeys = (await keyStore.ListAsync(tenantId, activeOnly: true, ct)).ToLookup(k => k.BranchId);
        var configured = O.Branches.Where(b => b.TenantId == tenantId).Select(b => b.BranchId)
            .Concat(activeKeys.Select(g => g.Key)).ToHashSet();

        var list = new List<BranchServerStatusDto>();
        foreach (var b in branches.Where(b => b.Local || configured.Contains(b.Id)))
        {
            rows.TryGetValue(b.Id, out var s);
            var pending = await PendingAsync(b.Id, ct);
            var dto = BranchHealth.Describe(O, b.Id, b.Name, b.Local, configured.Contains(b.Id), s, pending);
            var newest = activeKeys[b.Id].OrderByDescending(k => k.CreatedAt).FirstOrDefault();
            list.Add(dto with
            {
                ActiveKeys = activeKeys[b.Id].Count(),
                KeyHint = newest?.Hint,
                KeyCreatedAt = newest?.CreatedAt,
                KeyLastUsedAt = activeKeys[b.Id].Max(k => k.LastUsedAt),
                KeyInConfig = O.Branches.Any(c => c.BranchId == b.Id),
            });
        }
        return Ok(list.OrderBy(x => x.Name));
    }

    /// <summary>
    /// Issues a key for a branch server and returns it with a one-paste connection code for the installer.
    /// Shown once; only its hash is kept. Any older key keeps working until the branch first uses this one.
    /// </summary>
    [HttpPost("{branchId:guid}/key")]
    public async Task<IActionResult> IssueKey(Guid branchId, CancellationToken ct)
    {
        if (!O.IsCloud) return NotFound();
        var (tenantId, denied) = Check("settings.branches.edit");
        if (denied is not null) return denied;
        if (!(await ReadBranchesAsync(tenantId, ct)).Any(b => b.Id == branchId))
            return NotFound(new { error = "Branch not found." });
        if (!await BranchServersEnabledAsync(tenantId, ct))
            return Conflict(new { error = "Branch servers are not part of this workspace's plan. Ask Softaxis to enable \"cloud + continuous operations\"." });

        var by = User.FindFirst(System.Security.Claims.ClaimTypes.Name)?.Value ?? User.FindFirst("name")?.Value
                 ?? User.FindFirst("username")?.Value;
        var key = await keyStore.IssueAsync(branchId, tenantId, by, ct);
        var cloudUrl = configuration["BranchSync:PublicBaseUrl"] is { Length: > 0 } u ? u : $"{Request.Scheme}://{Request.Host}";
        return Ok(new IssuedBranchKeyDto(branchId, key, BranchKeyStore.ConnectionCode(cloudUrl, tenantId, branchId, key, User.FindFirst("modules")?.Value), cloudUrl, key[^4..]));
    }

    /// <summary>Revokes every key the branch holds - it stops syncing within seconds (stolen or retired PC).</summary>
    [HttpDelete("{branchId:guid}/key")]
    public async Task<IActionResult> RevokeKeys(Guid branchId, CancellationToken ct)
    {
        if (!O.IsCloud) return NotFound();
        var (tenantId, denied) = Check("settings.branches.edit");
        if (denied is not null) return denied;
        if (!(await ReadBranchesAsync(tenantId, ct)).Any(b => b.Id == branchId))
            return NotFound(new { error = "Branch not found." });
        var n = await keyStore.RevokeAllAsync(branchId, ct);
        return Ok(new { revoked = n, stillInConfig = O.Branches.Any(c => c.BranchId == branchId) });
    }

    private (Guid TenantId, IActionResult? Denied) Check(string permission)
    {
        var superAdmin = User.FindFirst("is_super_admin")?.Value == "true";
        if (!superAdmin && !User.FindAll("permission").Any(c => c.Value == permission))
            return (Guid.Empty, StatusCode(StatusCodes.Status403Forbidden, new { code = "Permission.Denied", description = $"Missing permission: {permission}" }));
        return Guid.TryParse(User.FindFirst("tenant_id")?.Value, out var t)
            ? (t, null)
            : (Guid.Empty, StatusCode(StatusCodes.Status403Forbidden, new { code = "Permission.Denied", description = "No workspace." }));
    }

    private sealed record BranchRow(Guid Id, string Name, bool Local);

    /// <summary>Whether this workspace was set up as "cloud + continuous operations" (branch servers allowed).</summary>
    private async Task<bool> BranchServersEnabledAsync(Guid tenantId, CancellationToken ct)
    {
        await using var conn = new SqlConnection(configuration.GetConnectionString("IdentityDb"));
        await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT BranchServersEnabled FROM [identity].[tenants] WHERE Id = @t";
        cmd.Parameters.Add(new SqlParameter("@t", tenantId));
        return await cmd.ExecuteScalarAsync(ct) is true;
    }

    private async Task<List<BranchRow>> ReadBranchesAsync(Guid tenantId, CancellationToken ct)
    {
        await using var conn = new SqlConnection(configuration.GetConnectionString("IdentityDb"));
        await conn.OpenAsync(ct);
        await using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT Id, Name, ISNULL(ServerMode, 'cloud') FROM [identity].[branches] WHERE TenantId = @t AND IsDeleted = 0";
        cmd.Parameters.Add(new SqlParameter("@t", tenantId));
        var list = new List<BranchRow>();
        await using var r = await cmd.ExecuteReaderAsync(ct);
        while (await r.ReadAsync(ct))
            list.Add(new BranchRow(r.GetGuid(0), r.GetString(1), string.Equals(r.GetString(2), "local", StringComparison.OrdinalIgnoreCase)));
        return list;
    }

    /// <summary>Work queued at head office that the branch has not answered yet.</summary>
    private async Task<BranchPending> PendingAsync(Guid branchId, CancellationToken ct)
    {
        try
        {
            await using var conn = new SqlConnection(configuration.GetConnectionString("RestaurantDb") ?? configuration.GetConnectionString("IdentityDb"));
            await conn.OpenAsync(ct);
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = """
                SELECT
                  (SELECT COUNT(*) FROM [restaurant].[RelayedOrders] o WHERE o.BranchId=@b AND NOT EXISTS (SELECT 1 FROM [restaurant].[RelayedOrderResults] r WHERE r.Id=o.Id)),
                  (SELECT COUNT(*) FROM [restaurant].[BranchInstructions] i WHERE i.BranchId=@b AND NOT EXISTS (SELECT 1 FROM [restaurant].[BranchInstructionResults] r WHERE r.Id=i.Id)),
                  (SELECT COUNT(*) FROM [restaurant].[RelayedOrderResults] r WHERE r.BranchId=@b AND r.Status='rejected' AND r.UpdatedAt > DATEADD(day,-1,SYSUTCDATETIME()))
                """;
            cmd.Parameters.Add(new SqlParameter("@b", branchId));
            await using var r = await cmd.ExecuteReaderAsync(ct);
            await r.ReadAsync(ct);
            return new BranchPending(r.GetInt32(0), r.GetInt32(1), r.GetInt32(2));
        }
        catch (SqlException)
        {
            return new BranchPending(0, 0, 0);   // restaurant tables not there yet (older schema)
        }
    }
}

public sealed record BranchPending(int Orders, int Instructions, int RejectedOrdersToday);

public sealed record BranchServerStatusDto(
    Guid      BranchId,
    string    Name,
    string    ServerMode,
    bool      Configured,
    string    State,          // ok | warning | error | offline | never | not_configured
    string    Summary,
    DateTime? LastSeenAt,
    DateTime? LastUpOkAt,
    DateTime? LastDownOkAt,
    string?   Version,
    string    CloudVersion,
    bool      VersionMatches,
    int?      ClockDriftSeconds,
    string?   LastError,
    int       ConsecutiveFailures,
    DateTime? FailingSince,
    long      UpRowsTotal,
    long      DownRowsTotal,
    int       PendingOrders,
    int       PendingInstructions,
    int       RejectedOrdersToday,
    DateTime? OfflineAlertAt)
{
    public int       ActiveKeys    { get; init; }
    public string?   KeyHint       { get; init; }
    public DateTime? KeyCreatedAt  { get; init; }
    public DateTime? KeyLastUsedAt { get; init; }
    /// <summary>The branch also has a key in server configuration, which this screen cannot revoke.</summary>
    public bool      KeyInConfig   { get; init; }
}

/// <summary>Turns what the cloud knows about a branch into one state and a plain sentence. Shared by the screen and the alerter.</summary>
public static class BranchHealth
{
    public static DateTime? LastSeen(Guid branchId, BranchStatusRow? s)
    {
        var mem = BranchPresence.LastSeenAt(branchId);
        var hb = s?.LastHeartbeatAt;
        return mem is null ? hb : hb is null ? mem : (mem > hb ? mem : hb);
    }

    public static BranchServerStatusDto Describe(BranchSyncOptions o, Guid id, string name, bool local, bool configured,
        BranchStatusRow? s, BranchPending pending)
    {
        var lastSeen = LastSeen(id, s);
        var offlineAfter = TimeSpan.FromMinutes(Math.Max(1, o.AlertAfterMinutes));
        var versionMatches = s?.Version is null || string.Equals(s.Version, BranchSyncVersion.Current, StringComparison.Ordinal);
        var drift = s?.ClockDriftSeconds;

        (string state, string summary) = (configured, lastSeen) switch
        {
            (false, _) => ("not_configured", "Set to run on its own server, but no branch key is configured on head office."),
            (_, null) => ("never", "The branch server has not connected yet."),
            _ when DateTime.UtcNow - lastSeen > offlineAfter =>
                ("offline", $"Not heard from for {Ago(lastSeen!.Value)}. The branch keeps trading; its sales arrive when it reconnects."),
            _ when drift is { } d && Math.Abs(d) > o.MaxClockDriftSeconds =>
                ("error", $"The branch clock is off by {Math.Abs(d) / 60} minute(s); uploads are paused until it is corrected."),
            _ when s is { ConsecutiveFailures: > 0 } =>
                ("error", $"Sync failing since {s.FailingSince:u}: {s.LastError}"),
            _ when !versionMatches => ("warning", $"Runs version {s!.Version}; head office runs {BranchSyncVersion.Current}. Update the branch server."),
            _ when pending.Orders > 0 || pending.Instructions > 0 => ("ok", "Connected; work is on its way to the branch."),
            _ => ("ok", "Connected and up to date."),
        };

        return new BranchServerStatusDto(id, name, local ? "local" : "cloud", configured, state, summary, lastSeen,
            s?.LastUpOkAt, s?.LastDownOkAt, s?.Version, BranchSyncVersion.Current, versionMatches, drift, s?.LastError,
            s?.ConsecutiveFailures ?? 0, s?.FailingSince, s?.UpRowsTotal ?? 0, s?.DownRowsTotal ?? 0,
            pending.Orders, pending.Instructions, pending.RejectedOrdersToday, s?.OfflineAlertAt);
    }

    public static string Ago(DateTime at)
    {
        var d = DateTime.UtcNow - at;
        return d.TotalMinutes < 90 ? $"{Math.Max(1, (int)d.TotalMinutes)} minute(s)"
             : d.TotalHours < 48 ? $"{(int)d.TotalHours} hour(s)" : $"{(int)d.TotalDays} day(s)";
    }
}

/// <summary>A newly issued branch key. The key and code are shown once.</summary>
public sealed record IssuedBranchKeyDto(Guid BranchId, string Key, string ConnectionCode, string CloudBaseUrl, string Hint);
