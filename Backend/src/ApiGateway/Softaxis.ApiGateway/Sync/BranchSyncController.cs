using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using Softaxis.BuildingBlocks.Application.Sync;
using Softaxis.BuildingBlocks.Infrastructure.Sync;
using Softaxis.BuildingBlocks.Infrastructure.Sync.Branch;

namespace Softaxis.ApiGateway.Sync;

/// <summary>
/// The cloud's side of a branch server's sync: receives what the branch owns, serves what head
/// office owns. Active only when <c>BranchSync:Mode = Cloud</c>; elsewhere every route is a 404.
///
/// <para>
/// <b>Authenticated by a per-branch key, not a user session.</b> A branch holds exactly one
/// credential, listed against its own branch id and workspace, and removing the entry revokes it.
/// A key for one branch is useless for another.
/// </para>
///
/// <para>See <c>docs/branch-server-design.md</c> §6 and §7.</para>
/// </summary>
[ApiController]
[AllowAnonymous]
[Route("api/sync/branch")]
public sealed class BranchSyncController(
    IOptions<BranchSyncOptions>   options,
    SyncReceiveStore              store,
    SyncSchemaReader              schema,
    BranchPullFilter              filter,
    IChangeCaptureService         capture,
    BranchKeyStore                keys,
    BranchStatusStore             statusStore,
    ILogger<BranchSyncController> logger) : ControllerBase
{
    private BranchSyncOptions O => options.Value;

    // ── UP: the branch pushes rows it owns ────────────────────────────────────

    [HttpPost("push")]
    public async Task<IActionResult> Push([FromBody] SyncPushRequest request, CancellationToken ct)
    {
        if (!O.IsCloud) return NotFound();
        var cred = await AuthenticateAsync(HttpContext.RequestAborted);
        if (cred is null) return Unauthorized(new { error = "Unknown branch or wrong key." });

        // A key is for one workspace. Without this a branch could write into another tenant.
        if (request.TenantId != cred.TenantId)
            return Unauthorized(new { error = "This branch is not authorised for that workspace." });
        BranchPresence.Seen(cred.BranchId);

        // A branch with a wrong clock would stamp its orders with wrong times. Uploads wait until it is fixed;
        // the branch keeps trading and nothing is lost, and the drift shows on the head-office screen.
        if (ClockDriftSeconds() is { } drift && Math.Abs(drift) > O.MaxClockDriftSeconds)
            return Conflict(new { error = $"This branch server's clock is off by {Math.Abs(drift) / 60} minute(s). Correct the clock; uploads resume automatically." });

        // Only tables the branch OWNS are accepted. Anything else - menu, users, prices - belongs to
        // head office, and a branch writing it is exactly the conflict this design rules out.
        var catalogue = await TablesAsync(SyncOwner.Branch, ct);
        var table = catalogue.FirstOrDefault(t => t.Name.Equals(request.TableName, StringComparison.OrdinalIgnoreCase));
        if (table is null)
            return StatusCode(StatusCodes.Status403Forbidden,
                new { error = $"'{request.TableName}' is not owned by a branch." });

        // A branch may only write its own branch's rows. Rows with no BranchId column (order lines)
        // belong to a parent that does carry one.
        foreach (var row in request.Rows)
        {
            if (row.Data is null || !row.Data.TryGetValue("BranchId", out var b) || b is null) continue;
            if (!Guid.TryParse(b.ToString(), out var rowBranch) || rowBranch != cred.BranchId)
            {
                logger.LogWarning("Branch sync: branch {Branch} sent a row for another branch ({Other}) in {Table}.",
                    cred.BranchId, b, table.Name);
                return StatusCode(StatusCodes.Status403Forbidden,
                    new { error = $"{table.Name}: a row belongs to a different branch." });
            }
        }

        await store.EnsureCreatedAsync(ct);
        return Ok(await store.ApplyAsync(request with { LicenseKey = string.Empty }, catalogue, ct));
    }

    // ── DOWN: the branch pulls what head office owns ──────────────────────────

    [HttpGet("pull")]
    public async Task<IActionResult> Pull(
        [FromQuery] string table, [FromQuery] long? since, [FromQuery] string? afterKey,
        [FromQuery] int take = 500, CancellationToken ct = default)
    {
        if (!O.IsCloud) return NotFound();
        var cred = await AuthenticateAsync(HttpContext.RequestAborted);
        if (cred is null) return Unauthorized(new { error = "Unknown branch or wrong key." });
        BranchPresence.Seen(cred.BranchId);

        var t = (await TablesAsync(SyncOwner.Cloud, ct))
            .FirstOrDefault(x => x.Name.Equals(table, StringComparison.OrdinalIgnoreCase));
        if (t is null)
            return StatusCode(StatusCodes.Status403Forbidden, new { error = $"'{table}' is not served to branches." });

        take = Math.Clamp(take, 1, 1000);
        var serverVersion = await capture.GetCurrentVersionAsync(ct);

        var seed = since is null ||
                   await capture.CheckWatermarkAsync(t, since, ct) is WatermarkState.Expired or WatermarkState.NeverSynced;

        ChangeBatch batch;
        if (seed)
            batch = await capture.ReadSeedPageAsync(t, cred.TenantId, DecodeKey(afterKey), take, ct);
        else
            batch = await capture.ReadChangesAsync(t, cred.TenantId, since!.Value, serverVersion, take, ct);

        // A branch is sent its own rows and the workspace-wide ones, never another branch's.
        var rows = (await filter.ApplyAsync(t, batch.Rows, cred.TenantId, cred.BranchId, ct))
            .Select(BranchSyncEngine.ToDto).ToList();

        return Ok(new BranchPullResponse(
            seed ? "seed" : "changes", rows, serverVersion, seed ? serverVersion : batch.ToVersion, batch.HasMore,
            seed && batch.Rows.Count > 0 ? batch.Rows[^1].Key.Select(k => k?.ToString() ?? "").ToList() : null));
    }

    /// <summary>The branch reports its health (see <see cref="BranchHeartbeat"/>), shown on the head-office screen.</summary>
    [HttpPost("heartbeat")]
    public async Task<IActionResult> Heartbeat([FromBody] BranchHeartbeat body, CancellationToken ct)
    {
        if (!O.IsCloud) return NotFound();
        var cred = await AuthenticateAsync(HttpContext.RequestAborted);
        if (cred is null) return Unauthorized(new { error = "Unknown branch or wrong key." });
        BranchPresence.Seen(cred.BranchId);

        var drift = (int)Math.Round((body.ClockUtc.ToUniversalTime() - DateTime.UtcNow).TotalSeconds);
        await statusStore.RecordHeartbeatAsync(cred.BranchId, cred.TenantId, body, drift, ct);
        return Ok(new { ok = true, cloudVersion = BranchSyncVersion.Current, clockDriftSeconds = drift });
    }

    /// <summary>For diagnostics: lets an operator confirm the branch can authenticate.</summary>
    [HttpGet("ping")]
    public async Task<IActionResult> Ping(CancellationToken ct) =>
        !O.IsCloud ? NotFound() : await AuthenticateAsync(ct) is null ? Unauthorized() : Ok(new { ok = true });

    // ── helpers ───────────────────────────────────────────────────────────────

    /// <summary>Branch clock minus cloud clock, from the <c>X-Branch-Clock</c> header; null if not sent.</summary>
    private int? ClockDriftSeconds() =>
        DateTime.TryParse(Request.Headers["X-Branch-Clock"].FirstOrDefault(), null,
            System.Globalization.DateTimeStyles.RoundtripKind, out var c)
            ? (int)Math.Round((c.ToUniversalTime() - DateTime.UtcNow).TotalSeconds)
            : null;

    /// <summary>A key from configuration (<c>BranchSync:Branches</c>) or one issued from the head-office screen.</summary>
    private async Task<BranchCredential?> AuthenticateAsync(CancellationToken ct)
    {
        if (!Guid.TryParse(Request.Headers["X-Branch-Id"].FirstOrDefault(), out var branchId)) return null;
        var key = Request.Headers["X-Branch-Key"].FirstOrDefault();
        if (string.IsNullOrWhiteSpace(key)) return null;

        var cred = O.Branches.FirstOrDefault(b => b.BranchId == branchId);
        if (cred is not null && !string.IsNullOrWhiteSpace(cred.Key))
        {
            // Constant-time compare: a branch key must not be recoverable by timing the response.
            var a = System.Text.Encoding.UTF8.GetBytes(cred.Key);
            var b = System.Text.Encoding.UTF8.GetBytes(key);
            if (System.Security.Cryptography.CryptographicOperations.FixedTimeEquals(a, b)) return cred;
        }
        // Issued keys are compared by their SHA-256 hash (stored, indexed), so timing reveals nothing about the key.
        return await keys.AuthenticateAsync(branchId, key, Request.Headers["X-Branch-Machine"].FirstOrDefault(), ct);
    }

    private async Task<IReadOnlyList<SyncTable>> TablesAsync(SyncOwner owner, CancellationToken ct)
    {
        var names = BranchSyncCatalog.OwnedBy(owner).Select(e => e.Table).ToHashSet(StringComparer.OrdinalIgnoreCase);
        var existing = await schema.ReadTablesAsync(BranchSyncCatalog.Schemas, ct);
        var tables = existing
            .Where(t => t.KeyColumns.Count > 0 && names.Contains($"{t.Schema}.{t.Table}"))
            .Select(t => new SyncTable(t.Schema, t.Table, t.KeyColumns, t.HasTenantId)).ToList();
        return SyncTableOrder.Sort(tables, await schema.ReadDependenciesAsync(BranchSyncCatalog.Schemas, ct));
    }


    private static IReadOnlyList<object>? DecodeKey(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try
        {
            var parts = JsonSerializer.Deserialize<List<string?>>(json);
            return parts?.Where(p => p is not null).Select(p => Guid.TryParse(p, out var g) ? (object)g : p!).ToList();
        }
        catch { return null; }
    }
}
