using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Services;

/// <summary>
/// Daily background job that generates invoices from due recurring templates.
/// Runs shortly after startup, then every 24h. Idempotent — only generates
/// invoices whose run date has arrived.
/// </summary>
public sealed class RecurringInvoiceHostedService(
    IServiceScopeFactory scopeFactory,
    ILogger<RecurringInvoiceHostedService> logger) : BackgroundService
{
    private static readonly TimeSpan Interval     = TimeSpan.FromHours(24);
    private static readonly TimeSpan StartupDelay = TimeSpan.FromMinutes(1);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try { await Task.Delay(StartupDelay, stoppingToken); } catch (OperationCanceledException) { return; }

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = scopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<FinanceDbContext>();
                var created = await RecurringInvoiceGenerator.GenerateDueAsync(db, DateTime.UtcNow, stoppingToken);
                if (created > 0)
                    logger.LogInformation("RecurringInvoices: generated {Count} invoice(s).", created);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "RecurringInvoices: generation run failed.");
            }

            try { await Task.Delay(Interval, stoppingToken); } catch (OperationCanceledException) { break; }
        }
    }
}
