using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Softaxis.Finance.Application.Abstractions;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Services;

/// <summary>
/// Daily background job that refreshes exchange rates from the online provider (USD base).
/// Runs shortly after startup, then every 24h. Fully resilient — a fetch failure is logged and
/// the seeded/last-known rates are kept (same fail-soft style as the recurring-invoice job).
/// </summary>
public sealed class ExchangeRateRefreshService(
    IServiceScopeFactory scopeFactory,
    ILogger<ExchangeRateRefreshService> logger) : BackgroundService
{
    private static readonly TimeSpan Interval     = TimeSpan.FromHours(24);
    private static readonly TimeSpan StartupDelay = TimeSpan.FromSeconds(20);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try { await Task.Delay(StartupDelay, stoppingToken); } catch (OperationCanceledException) { return; }

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = scopeFactory.CreateScope();
                var db       = scope.ServiceProvider.GetRequiredService<FinanceDbContext>();
                var provider = scope.ServiceProvider.GetRequiredService<IExchangeRateProvider>();
                var (updated, asOf) = await ExchangeRateUpserter.RefreshAsync(db, provider, stoppingToken);
                if (updated > 0)
                    logger.LogInformation("ExchangeRates: refreshed {Count} rate(s) as of {AsOf}.", updated, asOf);
                else
                    logger.LogInformation("ExchangeRates: no live rates applied (offline/disabled) — using seeded rates.");
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "ExchangeRates: refresh run failed.");
            }

            try { await Task.Delay(Interval, stoppingToken); } catch (OperationCanceledException) { break; }
        }
    }
}
