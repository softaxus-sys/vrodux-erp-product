using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Softaxis.BuildingBlocks.Application.Sync;

namespace Softaxis.BuildingBlocks.Infrastructure.Sync.Branch;

/// <summary>
/// One pass of the branch server's sync: push what the branch owns UP, pull what head office owns DOWN.
///
/// <para>
/// Reuses the mirror's machinery - change capture, per-table watermarks, the idempotent receiver and
/// its deferred-row queue - and changes only the direction rules: ownership comes from
/// <see cref="BranchSyncCatalog"/>, so a row is only ever written by its owner.
/// </para>
///
/// <para>See <c>docs/branch-server-design.md</c> §6.</para>
/// </summary>
public sealed class BranchSyncEngine(
    SyncSchemaReader          schema,
    SyncStateStore            state,
    IChangeCaptureService     capture,
    SyncReceiveStore          store,
    BranchSyncClient          client,
    IOptions<BranchSyncOptions> options,
    IConfiguration            configuration,
    BranchSyncStatus          status,
    ILogger<BranchSyncEngine> logger)
{
    private const int BatchSize = 500;
    private const int MaxBatchesPerTable = 200;
    private const string DownPrefix = "down:";

    private BranchSyncOptions O => options.Value;

    /// <summary>The tables of one owner, parents first.</summary>
    public async Task<IReadOnlyList<SyncTable>> CatalogueAsync(SyncOwner owner, CancellationToken ct, bool includeOpeningBalances = false)
    {
        var names = BranchSyncCatalog.OwnedBy(owner)
            .Select(e => e.Table).ToHashSet(StringComparer.OrdinalIgnoreCase);
        if (includeOpeningBalances) names.UnionWith(BranchSyncCatalog.OpeningBalances);

        var existing = await schema.ReadTablesAsync(BranchSyncCatalog.Schemas, ct);
        var tables = existing
            .Where(t => t.KeyColumns.Count > 0 && names.Contains($"{t.Schema}.{t.Table}"))
            .Select(t => new SyncTable(t.Schema, t.Table, t.KeyColumns, t.HasTenantId))
            .ToList();

        return SyncTableOrder.Sort(tables, await schema.ReadDependenciesAsync(BranchSyncCatalog.Schemas, ct));
    }

    public async Task RunOnceAsync(CancellationToken ct)
    {
        status.Passes++;
        await state.EnsureCreatedAsync(ct);
        await store.EnsureCreatedAsync(ct);

        // Up first: orders are the data that cannot be recreated. Down second: a stale menu is
        // an inconvenience, lost orders are not.
        try
        {
            status.UpRowsLastPass = await UpAsync(ct);
            status.UpRowsTotal += status.UpRowsLastPass;
            status.LastUpOkAt = DateTime.UtcNow;
            status.CloudReachable = true;

            status.DownRowsTotal += await DownAsync(ct);
            status.LastDownOkAt = DateTime.UtcNow;
            Recovered();
        }
        catch (SyncTransportException ex)
        {
            // The cloud is unreachable or refusing; the down pass would fail the same way.
            Failed(ex.Message);
        }

        await HeartbeatAsync(ct);
    }

    /// <summary>
    /// One warning when the link fails, another only if the reason changes or every 50th failed pass - not one
    /// per pass, which would bury the log during a long outage. One line when it comes back.
    /// </summary>
    private void Failed(string message)
    {
        status.CloudReachable = false;
        var changed = !string.Equals(status.LastError, message, StringComparison.Ordinal);
        status.LastError = message;
        status.ConsecutiveFailures++;
        status.FailingSince ??= DateTime.UtcNow;
        if (status.ConsecutiveFailures == 1 || changed || status.ConsecutiveFailures % 50 == 0)
            logger.LogWarning("Branch sync: failing ({Count} pass(es) since {Since:u}) - {Error}",
                status.ConsecutiveFailures, status.FailingSince, message);
    }

    private void Recovered()
    {
        if (status.ConsecutiveFailures > 0)
            logger.LogInformation("Branch sync: the cloud is reachable again after {Count} failed pass(es) since {Since:u}.",
                status.ConsecutiveFailures, status.FailingSince);
        status.ConsecutiveFailures = 0;
        status.FailingSince = null;
        status.LastError = null;
    }

    private async Task HeartbeatAsync(CancellationToken ct)
    {
        if (status.LastHeartbeatAt is { } last && DateTime.UtcNow - last < TimeSpan.FromSeconds(Math.Max(5, O.HeartbeatSeconds))
            && status.ConsecutiveFailures == 0)
            return;
        var sent = await client.HeartbeatAsync(new BranchHeartbeat(
            BranchSyncVersion.Current, DateTime.UtcNow, status.LastUpOkAt, status.LastDownOkAt, status.LastError,
            status.ConsecutiveFailures, status.FailingSince, status.UpRowsTotal, status.DownRowsTotal, status.UpRowsLastPass), ct);
        if (sent) status.LastHeartbeatAt = DateTime.UtcNow;
    }

    // ── UP ────────────────────────────────────────────────────────────────────

    private async Task<int> UpAsync(CancellationToken ct)
    {
        var catalogue = await CatalogueAsync(SyncOwner.Branch, ct);
        var marks = await state.ReadAllAsync(ct);
        var toVersion = await capture.GetCurrentVersionAsync(ct);
        var total = 0;

        foreach (var table in catalogue)
        {
            marks.TryGetValue(table.Name, out var mark);
            var wm = await capture.CheckWatermarkAsync(table, mark?.LastSyncedVersion, ct);
            var needsSeed = wm is WatermarkState.NeverSynced or WatermarkState.Expired || mark is { SeedCompleted: false };

            total += needsSeed
                ? await SeedUpAsync(table, mark, toVersion, ct)
                : await ChangesUpAsync(table, mark!.LastSyncedVersion!.Value, toVersion, ct);
        }
        return total;
    }

    private async Task<int> SeedUpAsync(SyncTable table, SyncTableState? mark, long toVersion, CancellationToken ct)
    {
        var after = DecodeKey(mark?.SeedCursor);
        var sent = 0;

        for (var i = 0; i < MaxBatchesPerTable; i++)
        {
            var page = await capture.ReadSeedPageAsync(table, O.TenantId, after, BatchSize, ct);
            if (page.Rows.Count == 0) break;

            var own = await OwnRowsAsync(table, page.Rows, ct);
            if (own.Count > 0) await SendUpAsync(table, own, 0, toVersion, ct);
            sent += own.Count;

            after = page.Rows[^1].Key;
            await state.SetSeedCursorAsync(table.Name, EncodeKey(after), ct);
            if (!page.HasMore) break;
        }

        await state.SetVersionAsync(table.Name, toVersion, ct);
        return sent;
    }

    private async Task<int> ChangesUpAsync(SyncTable table, long from, long toVersion, CancellationToken ct)
    {
        if (from >= toVersion) return 0;
        var sent = 0; var cursor = from;

        for (var i = 0; i < MaxBatchesPerTable; i++)
        {
            var batch = await capture.ReadChangesAsync(table, O.TenantId, cursor, toVersion, BatchSize, ct);
            if (batch.Rows.Count == 0) { await state.SetVersionAsync(table.Name, toVersion, ct); break; }

            var own = await OwnRowsAsync(table, batch.Rows, ct);
            if (own.Count > 0) await SendUpAsync(table, own, cursor, batch.ToVersion, ct);
            sent += own.Count;
            cursor = batch.ToVersion;
            await state.SetVersionAsync(table.Name, cursor, ct);

            if (!batch.HasMore) { await state.SetVersionAsync(table.Name, toVersion, ct); break; }
        }
        return sent;
    }

    /// <summary>
    /// Stock rows are keyed by warehouse: only rows of this branch's own warehouses go up. Head-office warehouse
    /// rows (which the branch may hold as an opening balance) and deletes (no warehouse to check) stay here.
    /// </summary>
    private async Task<IReadOnlyList<SyncRow>> OwnRowsAsync(SyncTable table, IReadOnlyList<SyncRow> rows, CancellationToken ct)
    {
        if (!BranchSyncCatalog.WarehouseOwned.TryGetValue(table.Name, out var column)) return rows;
        var mine = await BranchWarehouses.LoadAsync(configuration.GetConnectionString("IdentityDb"), O.TenantId, O.BranchId, ct);
        return rows.Where(r => r.Data is not null && r.Data.TryGetValue(column, out var w) && w is not null
                               && Guid.TryParse(w.ToString(), out var id) && mine.Contains(id)).ToList();
    }

    private async Task SendUpAsync(SyncTable table, IReadOnlyList<SyncRow> rows, long from, long to, CancellationToken ct)
    {
        var request = new SyncPushRequest(
            O.TenantId, O.BranchKey, Guid.NewGuid(), table.Name, from, to,
            rows.Select(ToDto).ToList());

        var response = await client.PushAsync(request, ct);
        if (response.Rejected > 0)
            throw new SyncTransportException(
                $"{table.Name}: the cloud rejected {response.Rejected} row(s). {string.Join(" | ", response.Errors.Take(3))}",
                retryable: false);
    }

    // ── DOWN ──────────────────────────────────────────────────────────────────

    private async Task<int> DownAsync(CancellationToken ct)
    {
        var catalogue = await CatalogueAsync(SyncOwner.Cloud, ct, includeOpeningBalances: true);
        var marks = await state.ReadAllAsync(ct);
        var total = 0;

        foreach (var table in catalogue)
        {
            var key = DownPrefix + table.Name;
            marks.TryGetValue(key, out var mark);
            total += await PullTableAsync(table, key, mark, catalogue, ct);
        }
        return total;
    }

    private async Task<int> PullTableAsync(
        SyncTable table, string stateKey, SyncTableState? mark, IReadOnlyList<SyncTable> catalogue, CancellationToken ct)
    {
        var applied = 0;
        var seedDone = mark is { SeedCompleted: true };
        long? since = seedDone ? mark!.LastSyncedVersion : null;
        var afterKey = seedDone ? null : mark?.SeedCursor;

        for (var i = 0; i < MaxBatchesPerTable; i++)
        {
            var page = await client.PullAsync(table.Name, since, afterKey, BatchSize, ct);

            // The cloud answered "seed" to an incremental request: our watermark aged out there.
            if (page.Mode == "seed" && seedDone)
            {
                await state.ResetAsync(stateKey, ct);
                seedDone = false; since = null;
            }

            if (page.Rows.Count > 0)
            {
                var result = await store.ApplyAsync(
                    new SyncPushRequest(O.TenantId, string.Empty, Guid.NewGuid(), table.Name, 0, page.ToVersion, page.Rows),
                    catalogue, ct,
                    // An opening balance is only ever inserted: from then on the branch owns that row.
                    new ApplyOptions(InsertOnly: BranchSyncCatalog.IsOpeningBalance(table.Name)));

                if (result.Rejected > 0)
                    throw new SyncTransportException(
                        $"{table.Name}: could not apply {result.Rejected} row(s) from the cloud. {string.Join(" | ", result.Errors.Take(3))}",
                        retryable: false);
                applied += result.Applied;
            }

            if (page.Mode == "seed")
            {
                if (page.HasMore)
                {
                    afterKey = JsonSerializer.Serialize(page.LastKey);
                    await state.SetSeedCursorAsync(stateKey, afterKey, ct);
                    continue;
                }
                await state.SetVersionAsync(stateKey, page.ServerVersion, ct);   // also marks the seed done
                break;
            }

            await state.SetVersionAsync(stateKey, page.ToVersion, ct);
            since = page.ToVersion;
            if (!page.HasMore) break;
        }
        return applied;
    }

    // ── helpers ───────────────────────────────────────────────────────────────

    public static SyncRowDto ToDto(SyncRow r) =>
        new(r.Op, r.Key, r.Data?.ToDictionary(k => k.Key, v => v.Value));

    private static string EncodeKey(IReadOnlyList<object> key) =>
        JsonSerializer.Serialize(key.Select(k => k?.ToString()));

    private static IReadOnlyList<object>? DecodeKey(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try
        {
            var parts = JsonSerializer.Deserialize<List<string?>>(json);
            return parts?.Where(p => p is not null)
                .Select(p => Guid.TryParse(p, out var g) ? (object)g : p!).ToList();
        }
        catch { return null; }
    }
}

/// <summary>Runs <see cref="BranchSyncEngine"/> continuously on a branch server.</summary>
public sealed class BranchSyncWorker(
    IServiceScopeFactory scopes, IOptions<BranchSyncOptions> options, BranchSyncStatus status, ILogger<BranchSyncWorker> logger)
    : BackgroundService
{
    /// <summary>The normal interval; doubling per failed pass while the cloud is down, up to MaxBackoffSeconds.</summary>
    public static TimeSpan NextDelay(BranchSyncOptions o, int failures)
    {
        var baseSeconds = Math.Max(1, o.IntervalSeconds);
        if (failures <= 0) return TimeSpan.FromSeconds(baseSeconds);
        var seconds = baseSeconds * Math.Pow(2, Math.Min(failures, 10));
        return TimeSpan.FromSeconds(Math.Min(seconds, Math.Max(baseSeconds, o.MaxBackoffSeconds)));
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var o = options.Value;
        // Not at startup: every MigrateAndSeed* is awaited before the app serves, and work started
        // earlier competes with it and can delay /health.
        try { await Task.Delay(TimeSpan.FromSeconds(Math.Max(5, o.StartupDelaySeconds)), stoppingToken); }
        catch (OperationCanceledException) { return; }

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = scopes.CreateScope();
                await scope.ServiceProvider.GetRequiredService<BranchSyncEngine>().RunOnceAsync(stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                // An unhandled exception here would end the worker for the process lifetime.
                logger.LogError(ex, "Branch sync: the pass failed.");
            }

            try { await Task.Delay(NextDelay(o, status.ConsecutiveFailures), stoppingToken); }
            catch (OperationCanceledException) { break; }
        }
    }
}

public static class BranchSyncExtensions
{
    public static IServiceCollection AddBranchSync(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<BranchSyncOptions>(configuration.GetSection(BranchSyncOptions.Section));
        services.AddSingleton<BranchSyncStatus>();
        services.AddSingleton<BranchPullFilter>();
        services.AddSingleton(new BranchStatusStore(configuration.GetConnectionString("IdentityDb") ?? string.Empty));
        services.AddSingleton(new BranchKeyStore(configuration.GetConnectionString("IdentityDb") ?? string.Empty));

        var o = configuration.GetSection(BranchSyncOptions.Section).Get<BranchSyncOptions>() ?? new();
        Application.Sync.BranchServerMode.IsBranch = o.IsBranch;
        if (o.IsBranch)
        {
            services.AddHttpClient<BranchSyncClient>(c => c.Timeout = TimeSpan.FromMinutes(2));
            services.AddScoped<BranchSyncEngine>();
            services.AddHostedService<BranchSyncWorker>();
        }
        return services;
    }

    /// <summary>
    /// Creates the bookkeeping tables and turns Change Tracking on for what this side reads:
    /// the branch reads its own tables to push them, the cloud reads head-office tables to serve pulls.
    /// Never throws - sync is not needed to trade.
    /// </summary>
    public static async Task PrepareBranchSyncAsync(this IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var sp = scope.ServiceProvider;
        var o = sp.GetRequiredService<IOptions<BranchSyncOptions>>().Value;
        if (!o.IsBranch && !o.IsCloud) return;

        var log = sp.GetRequiredService<ILoggerFactory>().CreateLogger("BranchSync");
        try
        {
            var cs = sp.GetRequiredService<IConfiguration>().GetConnectionString("IdentityDb") ?? string.Empty;
            await sp.GetRequiredService<SyncStateStore>().EnsureCreatedAsync();
            await sp.GetRequiredService<SyncReceiveStore>().EnsureCreatedAsync();
            if (o.IsCloud) await sp.GetRequiredService<BranchStatusStore>().EnsureCreatedAsync();
            if (o.IsCloud) await sp.GetRequiredService<BranchKeyStore>().EnsureCreatedAsync();

            var owner = o.IsBranch ? SyncOwner.Branch : SyncOwner.Cloud;
            var names = BranchSyncCatalog.OwnedBy(owner).Select(e => e.Table).ToHashSet(StringComparer.OrdinalIgnoreCase);
            if (o.IsCloud) names.UnionWith(BranchSyncCatalog.OpeningBalances);
            var existing = await sp.GetRequiredService<SyncSchemaReader>().ReadTablesAsync(BranchSyncCatalog.Schemas);
            var tables = existing
                .Where(t => t.KeyColumns.Count > 0 && names.Contains($"{t.Schema}.{t.Table}"))
                .Select(t => new SyncTable(t.Schema, t.Table, t.KeyColumns, t.HasTenantId)).ToList();

            var result = await new ChangeTrackingBootstrapper(cs, log).EnableAsync(tables);
            log.LogInformation("Branch sync ({Mode}): change tracking ready - {N} table(s), {New} newly tracked.",
                o.Mode, result.TablesInScope, result.NewlyEnabled);
        }
        catch (Exception ex)
        {
            log.LogError(ex, "Branch sync: could not prepare. The server trades normally; nothing will sync until this is fixed.");
        }
    }
}
