using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace Softaxis.BuildingBlocks.Infrastructure.Sync;

/// <summary>
/// Runs the nightly push at the configured local time.
///
/// <para>
/// <b>Never blocks trading.</b> Change-tracking reads are side-effect-free and take no locks on
/// business tables, and a failed run changes nothing locally beyond the settings row. The shop opens
/// in the morning whether or not last night worked.
/// </para>
///
/// <para>See <c>docs/on-premises-cloud-mirror.md</c> §9.</para>
/// </summary>
public sealed class SyncPushService(
    IServiceScopeFactory            scopeFactory,
    IConfiguration                  configuration,
    ILogger<SyncPushService>        logger) : BackgroundService
{
    /// <summary>
    /// Five minutes, not one. Every MigrateAndSeed* is awaited before the app starts serving, so
    /// work scheduled too early competes with startup and delays /health - which the deploy watches
    /// and rolls back on.
    /// </summary>
    private static readonly TimeSpan StartupDelay = TimeSpan.FromMinutes(5);

    /// <summary>
    /// Checked every minute against the local clock rather than slept-until. A long Task.Delay
    /// drifts, and survives neither a clock change nor an edit to the run time.
    /// </summary>
    private static readonly TimeSpan Tick = TimeSpan.FromMinutes(1);

    /// <summary>Backoff after a failure: 5 min, 15 min, 1 h, then wait for tomorrow's window.</summary>
    private static readonly TimeSpan[] Backoff =
        [TimeSpan.FromMinutes(5), TimeSpan.FromMinutes(15), TimeSpan.FromHours(1)];

    private DateOnly?  _lastRunLocalDate;
    private int        _failuresToday;
    private DateTime?  _retryNotBefore;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try { await Task.Delay(StartupDelay, stoppingToken); }
        catch (OperationCanceledException) { return; }

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await TickAsync(stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                // An unhandled exception here kills the service for the process lifetime, and
                // nothing would reach the mirror again until a restart nobody knows to perform.
                logger.LogError(ex, "Sync: the scheduler tick failed.");
            }

            try { await Task.Delay(Tick, stoppingToken); }
            catch (OperationCanceledException) { break; }
        }
    }

    private async Task TickAsync(CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var settings = scope.ServiceProvider.GetRequiredService<SyncSettingsStore>();

        var cfg = await settings.GetAsync(ct);
        if (cfg is null || !cfg.IsRunnable) return;

        var localNow   = TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, cfg.Zone);
        var localDate  = DateOnly.FromDateTime(localNow.DateTime);

        if (_lastRunLocalDate == localDate) return;            // already ran today
        if (_retryNotBefore is { } wait && DateTime.UtcNow < wait) return;

        // "At or past the window", not "exactly at it". An exact match sends nothing at all if the
        // box was off or busy for that one minute - the failure this feature exists to prevent.
        // A missed window still runs, later the same local day.
        if (localNow.TimeOfDay < cfg.RunAt) return;

        await RunOnceAsync(scope.ServiceProvider, localDate, ct);
    }

    private async Task RunOnceAsync(IServiceProvider sp, DateOnly localDate, CancellationToken ct)
    {
        var runner     = sp.GetRequiredService<SyncPushRunner>();
        var licenseKey = configuration["OnPremises:LicenseKey"]?.Trim() ?? string.Empty;

        var result = await runner.RunAsync(licenseKey, "scheduled", ct);

        if (!result.Ran)
        {
            // Not a failure - nothing to do. Recording the date stops it re-deciding every minute.
            _lastRunLocalDate = localDate;
            return;
        }

        if (result.Succeeded)
        {
            _lastRunLocalDate = localDate;
            _failuresToday    = 0;
            _retryNotBefore   = null;
            return;
        }

        // Failed: schedule a retry inside the same local day, then give up until tomorrow's window.
        // The watermark is exactly where the run stopped, so a retry resumes rather than repeats.
        if (_failuresToday < Backoff.Length)
        {
            _retryNotBefore = DateTime.UtcNow + Backoff[_failuresToday];
            logger.LogWarning(
                "Sync: run failed ({Failed} table(s)); retrying in {Delay}.",
                result.TablesFailed, Backoff[_failuresToday]);
            _failuresToday++;
        }
        else
        {
            _lastRunLocalDate = localDate;
            _failuresToday    = 0;
            _retryNotBefore   = null;
            logger.LogError(
                "Sync: run failed after {Attempts} attempts today; waiting for tomorrow's window. " +
                "Nothing has been lost - the next run resumes from the last confirmed batch.",
                Backoff.Length + 1);
        }
    }
}
