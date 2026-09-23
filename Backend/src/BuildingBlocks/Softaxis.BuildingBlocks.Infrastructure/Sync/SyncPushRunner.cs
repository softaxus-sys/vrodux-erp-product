using System.Text.Json;
using Microsoft.Extensions.Logging;
using Softaxis.BuildingBlocks.Application.Sync;

namespace Softaxis.BuildingBlocks.Infrastructure.Sync;

/// <summary>What one table did in a run.</summary>
public sealed record SyncTableResult(
    string Table, int RowsSent, int Deferred, int Rejected, bool Seeded, bool Complete, string? Error);

/// <summary>What a whole run did. <paramref name="Ran"/> is false when it was skipped outright.</summary>
public sealed record SyncRunResult(
    bool Ran,
    string? SkippedReason,
    int TablesProcessed,
    int RowsSent,
    int TablesFailed,
    IReadOnlyList<SyncTableResult> Tables)
{
    public bool Succeeded => Ran && TablesFailed == 0;

    public static SyncRunResult Skipped(string reason) => new(false, reason, 0, 0, 0, []);
}

/// <summary>
/// One push: reads what changed since the last successful run and sends it to the cloud mirror,
/// table by table, parents first.
///
/// <para>See <c>docs/on-premises-cloud-mirror.md</c> §5 and §6.</para>
/// </summary>
public sealed class SyncPushRunner(
    SyncSettingsStore        settings,
    SyncStateStore           state,
    SyncRunLogStore          runLog,
    SyncSchemaReader         schema,
    IChangeCaptureService    capture,
    SyncPushClient           client,
    ISyncAlerter             alerter,
    ILogger<SyncPushRunner>  logger)
{
    /// <summary>
    /// 500 rows per batch. Small enough that a poor connection makes partial progress instead of
    /// losing a whole night's work, large enough not to turn a day's trading into thousands of
    /// round trips.
    /// </summary>
    private const int BatchSize = 500;

    /// <summary>
    /// A ceiling on batches per table per run, so one enormous table cannot monopolise the window
    /// and starve the rest. What it does not finish is picked up by the next run - the watermark
    /// is exactly where it left off.
    /// </summary>
    private const int MaxBatchesPerTable = 400;

    public async Task<SyncRunResult> RunAsync(
        string licenseKey, string trigger = "scheduled", CancellationToken ct = default)
    {
        var runId = await runLog.StartAsync(trigger, ct);
        try
        {
            var result = await ExecuteAsync(licenseKey, ct);
            await runLog.FinishAsync(runId, result.Ran, result.Succeeded,
                result.TablesProcessed, result.TablesFailed, result.RowsSent,
                result.SkippedReason ?? result.Tables.FirstOrDefault(t => t.Error is not null)?.Error, ct);
            return result;
        }
        catch (Exception ex)
        {
            // The row was opened before the work started, so a crash is recorded rather than
            // leaving a gap that reads as "it never ran".
            await runLog.FinishAsync(runId, true, false, 0, 1, 0, ex.Message, CancellationToken.None);
            throw;
        }
    }

    private async Task<SyncRunResult> ExecuteAsync(string licenseKey, CancellationToken ct)
    {
        var cfg = await settings.GetAsync(ct);
        if (cfg is null)            return SyncRunResult.Skipped("This installation has no cloud-sync configuration.");
        if (!cfg.Enabled)           return SyncRunResult.Skipped("Cloud sync is switched off.");
        if (!cfg.IsRunnable)        return SyncRunResult.Skipped("No cloud address is configured.");
        if (string.IsNullOrWhiteSpace(licenseKey))
            return SyncRunResult.Skipped("No licence key is configured, so the mirror cannot authenticate this installation.");

        await settings.RecordAttemptAsync(cfg.TenantId, ct);

        // One upper bound for the whole run, taken FIRST. Everything written while the run is in
        // flight is simply picked up next time; without the bound a busy shop's table could be
        // chased indefinitely and never finish.
        var toVersion = await capture.GetCurrentVersionAsync(ct);

        var schemas   = SyncTableCatalog.BusinessSchemas.Append("identity").ToArray();
        var existing  = await schema.ReadTablesAsync(schemas, ct);
        var catalogue = SyncTableOrder.Sort(
            SyncTableCatalog.Build(existing),
            await schema.ReadDependenciesAsync(schemas, ct));

        await state.EnsureCreatedAsync(ct);
        var watermarks = await state.ReadAllAsync(ct);

        var results  = new List<SyncTableResult>(catalogue.Count);
        var rowsSent = 0;

        foreach (var table in catalogue)
        {
            if (ct.IsCancellationRequested) break;

            watermarks.TryGetValue(table.Name, out var mark);

            try
            {
                var result = await PushTableAsync(cfg, licenseKey, table, mark, toVersion, ct);
                results.Add(result);
                rowsSent += result.RowsSent;
            }
            catch (SyncTransportException ex)
            {
                // The link is down or the mirror is refusing us: every remaining table would fail
                // the same way, so stop rather than logging sixty identical errors. Progress made
                // so far is already checkpointed.
                results.Add(new SyncTableResult(table.Name, 0, 0, 0, false, false, ex.Message));
                logger.LogError(ex, "Sync: aborting the run at {Table}.", table.Name);
                break;
            }
            catch (Exception ex)
            {
                // A fault specific to this table - a schema mismatch, unreadable data. The other
                // tables are independent and their data should still reach the mirror.
                results.Add(new SyncTableResult(table.Name, 0, 0, 0, false, false, ex.Message));
                logger.LogError(ex, "Sync: {Table} failed; continuing with the rest.", table.Name);
            }
        }

        var failed = results.Count(r => r.Error is not null);
        var run    = new SyncRunResult(true, null, results.Count, rowsSent, failed, results);

        if (run.Succeeded)
        {
            // Read BEFORE clearing, so the all-clear can be sent only to someone who was told.
            var priorFailures = cfg.ConsecutiveFailures;
            await settings.RecordSuccessAsync(cfg.TenantId, ct);

            logger.LogInformation(
                "Sync: pushed {Rows} row(s) across {Tables} table(s) to {Url}.",
                rowsSent, results.Count, cfg.CloudBaseUrl);

            if (priorFailures > 0)
                await SafeAlertAsync(() => alerter.RecoveredAsync(cfg.TenantId, priorFailures, ct));
        }
        else
        {
            var first = results.First(r => r.Error is not null);
            var error = $"{first.Table}: {first.Error}";
            await settings.RecordFailureAsync(cfg.TenantId, error, ct);

            logger.LogWarning(
                "Sync: {Failed} of {Total} table(s) failed. First: {Table} - {Error}",
                failed, results.Count, first.Table, first.Error);

            await SafeAlertAsync(() => alerter.FailedAsync(cfg.TenantId, cfg.ConsecutiveFailures + 1, error, ct));
        }

        return run;
    }

    // ── One table ─────────────────────────────────────────────────────────────

    private async Task<SyncTableResult> PushTableAsync(
        SyncSettings cfg, string licenseKey, SyncTable table,
        SyncTableState? mark, long toVersion, CancellationToken ct)
    {
        var watermark = await capture.CheckWatermarkAsync(table, mark?.LastSyncedVersion, ct);

        // A seed is needed when the table has never synced, when its watermark has aged past the
        // retention window, or when an earlier seed was interrupted part-way.
        var needsSeed = cfg.ReseedRequired
                     || watermark is WatermarkState.NeverSynced or WatermarkState.Expired
                     || mark is { SeedCompleted: false };

        if (watermark == WatermarkState.Expired)
        {
            logger.LogWarning(
                "Sync: {Table}'s watermark has aged past the retention window; reseeding the whole table. " +
                "Change tracking can no longer say what changed, and continuing from it would leave the " +
                "mirror quietly missing rows.", table.Name);
        }

        return needsSeed
            ? await SeedTableAsync(cfg, licenseKey, table, mark, toVersion, ct)
            : await PushChangesAsync(cfg, licenseKey, table, mark!.LastSyncedVersion!.Value, toVersion, ct);
    }

    /// <summary>
    /// Full export, paged by primary key and resumable: the cursor is saved after each batch, so an
    /// interrupted seed of a large table continues instead of starting over.
    ///
    /// <para>
    /// The watermark is only set once the whole table has been sent, and it is set to the version
    /// captured at the START of the run - so anything written during the export is replayed by the
    /// next incremental run rather than lost. Replay is harmless because the upsert is idempotent.
    /// </para>
    /// </summary>
    private async Task<SyncTableResult> SeedTableAsync(
        SyncSettings cfg, string licenseKey, SyncTable table,
        SyncTableState? mark, long toVersion, CancellationToken ct)
    {
        var afterKey = DecodeCursor(mark?.SeedCursor);
        var sent = 0; var deferred = 0; var rejected = 0; var batches = 0;

        while (batches++ < MaxBatchesPerTable)
        {
            if (ct.IsCancellationRequested)
                return new SyncTableResult(table.Name, sent, deferred, rejected, true, false, null);

            var page = await capture.ReadSeedPageAsync(table, cfg.TenantId, afterKey, BatchSize, ct);
            if (page.Rows.Count == 0) break;

            var response = await SendAsync(cfg, licenseKey, table, page.Rows, 0, toVersion, ct);
            if (response.Rejected > 0)
                return new SyncTableResult(table.Name, sent, deferred, rejected, true, false,
                    Describe(response));

            sent     += response.Applied;
            deferred += response.Deferred;

            afterKey = page.Rows[^1].Key;
            await state.SetSeedCursorAsync(table.Name, EncodeCursor(afterKey), ct);

            if (!page.HasMore) break;
        }

        // Only now is the table complete. SetVersionAsync also marks the seed done and clears the
        // cursor, so the next run reads changes rather than re-exporting.
        await state.SetVersionAsync(table.Name, toVersion, ct);
        await settings.SetReseedRequiredAsync(cfg.TenantId, false, ct);

        logger.LogInformation("Sync: seeded {Table} - {Rows} row(s).", table.Name, sent);
        return new SyncTableResult(table.Name, sent, deferred, rejected, true, true, null);
    }

    /// <summary>
    /// Incremental push. The watermark advances per batch, and only on a clean response - advancing
    /// optimistically turns a transient failure into permanently missing data.
    /// </summary>
    private async Task<SyncTableResult> PushChangesAsync(
        SyncSettings cfg, string licenseKey, SyncTable table,
        long fromVersion, long toVersion, CancellationToken ct)
    {
        if (fromVersion >= toVersion)
            return new SyncTableResult(table.Name, 0, 0, 0, false, true, null);

        var sent = 0; var deferred = 0; var batches = 0;
        var cursor = fromVersion;

        while (batches++ < MaxBatchesPerTable)
        {
            if (ct.IsCancellationRequested)
                return new SyncTableResult(table.Name, sent, deferred, 0, false, false, null);

            var batch = await capture.ReadChangesAsync(table, cfg.TenantId, cursor, toVersion, BatchSize, ct);
            if (batch.Rows.Count == 0)
            {
                // Nothing left in range: record that we are current as of the run's upper bound.
                await state.SetVersionAsync(table.Name, toVersion, ct);
                break;
            }

            var response = await SendAsync(cfg, licenseKey, table, batch.Rows, cursor, batch.ToVersion, ct);
            if (response.Rejected > 0)
                return new SyncTableResult(table.Name, sent, deferred, response.Rejected, false, false,
                    Describe(response));

            sent     += response.Applied;
            deferred += response.Deferred;
            cursor    = batch.ToVersion;

            await state.SetVersionAsync(table.Name, cursor, ct);

            if (!batch.HasMore)
            {
                await state.SetVersionAsync(table.Name, toVersion, ct);
                break;
            }
        }

        if (sent > 0)
            logger.LogInformation("Sync: {Table} - {Rows} row(s) pushed.", table.Name, sent);

        return new SyncTableResult(table.Name, sent, deferred, 0, false, true, null);
    }

    private Task<SyncPushResponse> SendAsync(
        SyncSettings cfg, string licenseKey, SyncTable table, IReadOnlyList<SyncRow> rows,
        long fromVersion, long toVersion, CancellationToken ct)
    {
        var request = new SyncPushRequest(
            cfg.TenantId,
            licenseKey,
            // A fresh id per batch. The receiver's ledger is keyed on it, so a retry of THIS batch
            // is recognised, while a genuinely new batch is never mistaken for one already applied.
            Guid.NewGuid(),
            table.Name,
            fromVersion,
            toVersion,
            rows.Select(r => new SyncRowDto(r.Op, r.Key, r.Data?.ToDictionary(k => k.Key, v => v.Value))).ToList());

        return client.PushAsync(cfg.CloudBaseUrl, request, ct);
    }

    /// <summary>
    /// An alert that cannot be sent - dead SMTP, unreachable notification store - must never turn a
    /// recoverable sync failure into a crashed background service. The log still has the detail.
    /// </summary>
    private async Task SafeAlertAsync(Func<Task> send)
    {
        try { await send(); }
        catch (Exception ex) { logger.LogError(ex, "Sync: could not send the alert."); }
    }

    private static string Describe(SyncPushResponse r) =>
        r.Errors.Count > 0 ? string.Join(" | ", r.Errors.Take(3)) : $"{r.Rejected} row(s) rejected.";

    // ── Seed cursor ───────────────────────────────────────────────────────────
    //
    // Stored as JSON strings. Keys are GUIDs in every table in scope, and the seed query compares
    // them as their real type through parameters - the cursor only has to survive a restart, not
    // be typed.

    private static string EncodeCursor(IReadOnlyList<object> key) =>
        JsonSerializer.Serialize(key.Select(k => k?.ToString()));

    private static IReadOnlyList<object>? DecodeCursor(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try
        {
            var parts = JsonSerializer.Deserialize<List<string?>>(json);
            if (parts is null || parts.Count == 0) return null;

            return parts
                .Select(p => Guid.TryParse(p, out var g) ? g : (object?)p)
                .Where(v => v is not null)
                .Select(v => v!)
                .ToList();
        }
        catch { return null; }   // a corrupt cursor restarts the seed rather than stopping it
    }
}
