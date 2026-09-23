using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Softaxis.BuildingBlocks.Infrastructure.Sync;
using Softaxis.Identity.API.Authorization;
using Softaxis.Identity.Application.Abstractions;

namespace Softaxis.ApiGateway.Sync;

public sealed record SyncSettingsDto(
    bool      Enabled,
    string    CloudBaseUrl,
    string    RunAtLocalTime,
    string    TimeZoneId,
    DateTime? LastAttemptAt,
    DateTime? LastSuccessAt,
    int       ConsecutiveFailures,
    string?   LastError,
    bool      ReseedRequired,
    bool      LicenceConfigured,
    IReadOnlyList<SyncTableStatusDto> Tables);

public sealed record SyncTableStatusDto(
    string TableName, long? LastSyncedVersion, DateTime? LastSyncedAt, bool SeedCompleted);

public sealed record UpdateSyncSettingsRequest(
    bool Enabled, string CloudBaseUrl, string RunAtLocalTime, string TimeZoneId);

public sealed record SyncRunDto(
    long Id, DateTime StartedAt, DateTime? FinishedAt, string Trigger,
    bool Ran, bool Succeeded, int TablesProcessed, int TablesFailed, int RowsSent, string? Message);

/// <summary>
/// The Cloud Sync screen on an ON-PREMISES installation: when the nightly push runs, where it pushes,
/// how the last run went, and a manual trigger.
///
/// <para>
/// Distinct from <c>SyncPushController</c> in every way that matters. That one receives, runs in the
/// cloud, and authenticates with the installation's licence key because there is no user behind a
/// nightly job. This one configures, runs in the shop, and authenticates a signed-in administrator.
/// </para>
///
/// <para>
/// Not CQRS, deliberately: this is installation configuration held outside any module's DbContext,
/// read and written by one store that the background service shares. Routing it through a module's
/// Application layer would put on-premises plumbing inside Identity's domain for no benefit. The
/// mandatory CQRS rule covers module controllers; the gateway's own plumbing endpoints
/// (notifications, sync) follow the same shape as each other.
/// </para>
///
/// <para>
/// Gated on <c>settings.integrations.edit</c>. There is no dedicated sync permission key and adding
/// one would need a migration; connecting this installation to the cloud is an integration, and that
/// key is already held by the administrators who would configure it. The same key decides who gets
/// the failure alert, so nobody is told about something they cannot open.
/// </para>
///
/// <para>See <c>docs/on-premises-cloud-mirror.md</c> §3.2 and §10.</para>
/// </summary>
[ApiController]
[Authorize]
[RequirePermission("settings.integrations.edit")]
[Route("api/sync")]
public sealed class SyncSettingsController(
    SyncSettingsStore            settings,
    SyncStateStore               state,
    SyncRunLogStore              runLog,
    SyncPushRunner               runner,
    ITenantContext               tenantContext,
    IConfiguration               configuration,
    ILogger<SyncSettingsController> logger) : ControllerBase
{
    /// <summary>Current configuration, how the last run went, and where each table has got to.</summary>
    [HttpGet("settings")]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        var cfg = await settings.GetAsync(ct);
        var licence = !string.IsNullOrWhiteSpace(configuration["OnPremises:LicenseKey"]);

        // Never configured is a normal state, not an error: it is what every cloud deployment and
        // every freshly installed box looks like. Answer with sensible defaults so the screen can
        // render a form rather than an error.
        if (cfg is null)
            return Ok(new SyncSettingsDto(
                false, string.Empty, "23:30", "Asia/Dubai",
                null, null, 0, null, false, licence, []));

        var marks = await state.ReadAllAsync(ct);
        var tables = marks.Values
            .OrderBy(m => m.TableName, StringComparer.OrdinalIgnoreCase)
            .Select(m => new SyncTableStatusDto(m.TableName, m.LastSyncedVersion, m.LastSyncedAt, m.SeedCompleted))
            .ToList();

        return Ok(new SyncSettingsDto(
            cfg.Enabled, cfg.CloudBaseUrl, cfg.RunAtLocalTime, cfg.TimeZoneId,
            cfg.LastAttemptAt, cfg.LastSuccessAt, cfg.ConsecutiveFailures, cfg.LastError,
            cfg.ReseedRequired, licence, tables));
    }

    /// <summary>Sets when and where the nightly push runs.</summary>
    [HttpPut("settings")]
    public async Task<IActionResult> Update([FromBody] UpdateSyncSettingsRequest req, CancellationToken ct)
    {
        if (tenantContext.TenantId is not { } tenantId)
            return BadRequest(new { error = "This endpoint runs on a workspace's own installation; no workspace is resolved." });

        // Validate BEFORE saving. A bad time or zone stored here is only discovered when a night
        // silently does not happen, which is the hardest kind of failure to notice.
        if (!TimeSpan.TryParseExact(req.RunAtLocalTime, @"hh\:mm", null, out var runAt) ||
            runAt >= TimeSpan.FromDays(1))
            return BadRequest(new { error = "Run time must be a 24-hour local time, e.g. 23:30." });

        try { TimeZoneInfo.FindSystemTimeZoneById(req.TimeZoneId); }
        catch
        {
            return BadRequest(new { error = $"'{req.TimeZoneId}' is not a time zone this server recognises." });
        }

        var url = (req.CloudBaseUrl ?? string.Empty).Trim();
        if (req.Enabled)
        {
            if (!Uri.TryCreate(url, UriKind.Absolute, out var uri) ||
                (uri.Scheme != Uri.UriSchemeHttps && uri.Scheme != Uri.UriSchemeHttp))
                return BadRequest(new { error = "Enter the cloud address to push to, e.g. https://erp.vrodux.com." });

            // The batch carries a licence key and a whole day's business data. Over plain HTTP both
            // are readable by anything between the shop and the cloud.
            if (uri.Scheme == Uri.UriSchemeHttp && !uri.IsLoopback)
                return BadRequest(new { error = "Use https for the cloud address. Business data and the licence key travel in every batch." });
        }

        await settings.SaveAsync(tenantId, req.Enabled, url, req.RunAtLocalTime, req.TimeZoneId, ct);

        logger.LogInformation(
            "Sync: configuration updated - {State}, {Url}, {Time} {Zone}.",
            req.Enabled ? "enabled" : "disabled", url, req.RunAtLocalTime, req.TimeZoneId);

        return await Get(ct);
    }

    /// <summary>
    /// Runs the push now. The first thing anyone asks after a failure alert is whether it works
    /// yet, and waiting until 23:30 to find out is not an answer.
    /// </summary>
    [HttpPost("run")]
    public async Task<IActionResult> RunNow(CancellationToken ct)
    {
        var licenceKey = configuration["OnPremises:LicenseKey"]?.Trim() ?? string.Empty;
        var result = await runner.RunAsync(licenceKey, "manual", ct);

        // A skipped run is reported as such rather than as a success - "done" for something that
        // never started is the most misleading thing this could say.
        return Ok(new
        {
            ran            = result.Ran,
            skippedReason  = result.SkippedReason,
            succeeded      = result.Succeeded,
            rowsSent       = result.RowsSent,
            tablesProcessed = result.TablesProcessed,
            tablesFailed   = result.TablesFailed,
            failures       = result.Tables.Where(t => t.Error is not null)
                                          .Select(t => new { table = t.Table, error = t.Error }),
        });
    }

    /// <summary>
    /// Recent runs, newest first. Current state answers "is it working"; this answers "when did it
    /// stop", which is the question that actually leads somewhere.
    /// </summary>
    [HttpGet("runs")]
    public async Task<IActionResult> Runs([FromQuery] int take = 30, CancellationToken ct = default)
    {
        var entries = await runLog.RecentAsync(Math.Clamp(take, 1, 100), ct);
        return Ok(entries.Select(e => new SyncRunDto(
            e.Id, e.StartedAt, e.FinishedAt, e.Trigger, e.Ran, e.Succeeded,
            e.TablesProcessed, e.TablesFailed, e.RowsSent, e.Message)));
    }

    /// <summary>
    /// Forces a full re-export on the next run by clearing every watermark.
    ///
    /// <para>
    /// The repair for a mirror that is wrong rather than merely behind - a restored cloud database,
    /// or a table edited there before the read-only guard existed. Safe but not free: the next run
    /// re-sends everything, which on a busy site is a long push. It deletes nothing on either side;
    /// the receiver upserts, so rows are refreshed rather than duplicated.
    /// </para>
    /// </summary>
    [HttpPost("reseed")]
    public async Task<IActionResult> Reseed(CancellationToken ct)
    {
        if (tenantContext.TenantId is not { } tenantId)
            return BadRequest(new { error = "No workspace is resolved." });

        var marks = await state.ReadAllAsync(ct);
        foreach (var m in marks.Values)
            await state.ResetAsync(m.TableName, ct);

        await settings.SetReseedRequiredAsync(tenantId, true, ct);

        logger.LogWarning(
            "Sync: a full reseed was requested - {Count} table watermark(s) cleared. The next run " +
            "re-exports everything.", marks.Count);

        return Ok(new { cleared = marks.Count, message = "Every table will be re-exported on the next run." });
    }
}
