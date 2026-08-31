using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.Finance.Application.Abstractions;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Services;

/// <summary>
/// Daily job that generates invoices from due recurring templates and emails the ones set to
/// auto-send. Runs shortly after startup, then every 24h. Idempotent — a template only produces an
/// invoice once its run date has arrived, and the run date advances as it does.
/// </summary>
public sealed class RecurringInvoiceHostedService(
    IServiceScopeFactory scopeFactory,
    ILogger<RecurringInvoiceHostedService> logger) : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromHours(24);

    // Five minutes, not one: every MigrateAndSeed* is awaited before the app starts serving, so
    // work scheduled too early competes with startup and delays /health.
    private static readonly TimeSpan StartupDelay = TimeSpan.FromMinutes(5);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try { await Task.Delay(StartupDelay, stoppingToken); } catch (OperationCanceledException) { return; }

        while (!stoppingToken.IsCancellationRequested)
        {
            try { await RunAllTenantsAsync(stoppingToken); }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                // An unhandled exception here would kill the service for the process lifetime, and
                // nobody's invoices would go out again until the next restart.
                logger.LogError(ex, "RecurringInvoices: generation run failed.");
            }

            try { await Task.Delay(Interval, stoppingToken); } catch (OperationCanceledException) { break; }
        }
    }

    private sealed record TenantCurrencyRow(Guid Id, string? Currency);

    private async Task RunAllTenantsAsync(CancellationToken ct)
    {
        List<Guid> tenantIds;
        var currencies = new Dictionary<Guid, string?>();

        using (var lookupScope = scopeFactory.CreateScope())
        {
            var db = lookupScope.ServiceProvider.GetRequiredService<FinanceDbContext>();

            // No ambient tenant here, so the global filter would hide everything: IgnoreQueryFilters
            // is required to see across workspaces, and the tenant column is a shadow property that
            // has to be read through EF.Property.
            tenantIds = await db.RecurringInvoices
                .IgnoreQueryFilters()
                .Where(r => r.IsActive && !r.IsDeleted)
                .Select(r => EF.Property<Guid?>(r, "TenantId"))
                .Where(id => id != null)
                .Distinct()
                .Select(id => id!.Value)
                .ToListAsync(ct);

            if (tenantIds.Count == 0) return;

            // Each workspace's operating currency, so the ambient context carries it into the
            // generated invoices. Without this, TenantAmbient.Currency is null, Invoice's default
            // falls back through TenantCurrency to "AED", and a PKR workspace has every recurring
            // invoice stamped in the wrong currency. One query, not one per workspace.
            // "identity" is a RESERVED SQL Server keyword and MUST be bracketed.
            try
            {
                var rows = await db.Database
                    .SqlQuery<TenantCurrencyRow>($"SELECT [Id], [Currency] FROM [identity].[tenants]")
                    .ToListAsync(ct);
                foreach (var r in rows) currencies[r.Id] = r.Currency;
            }
            catch (Exception ex)
            {
                // Falls back to the entity default rather than stopping invoicing outright.
                logger.LogWarning(ex, "RecurringInvoices: could not resolve tenant currencies.");
            }
        }

        foreach (var tenantId in tenantIds)
        {
            if (ct.IsCancellationRequested) return;

            // A fresh scope per workspace: the DbContext is scoped, and reusing one across tenants
            // would carry the previous tenant's tracked entities into the next one's queries.
            using var scope = scopeFactory.CreateScope();
            try
            {
                TenantAmbient.Set(tenantId, isSuperAdmin: false, isResolved: true,
                    currency: currencies.GetValueOrDefault(tenantId));

                var db    = scope.ServiceProvider.GetRequiredService<FinanceDbContext>();
                var email = scope.ServiceProvider.GetRequiredService<IFinanceEmailService>();

                var result = await RecurringInvoiceGenerator.GenerateDueAsync(db, DateTime.UtcNow, email, ct);

                if (result.Created > 0 || result.EmailFailed > 0)
                    logger.LogInformation(
                        "RecurringInvoices: workspace {TenantId} — {Created} generated, {Emailed} emailed, {Failed} failed to send.",
                        tenantId, result.Created, result.Emailed, result.EmailFailed);
            }
            catch (Exception ex)
            {
                // One workspace's bad data must not stop every other workspace's invoicing.
                logger.LogError(ex, "RecurringInvoices: run failed for workspace {TenantId}.", tenantId);
            }
            finally
            {
                // Must be cleared: the ambient tenant is an AsyncLocal and would otherwise leak
                // into whatever runs next on this thread.
                TenantAmbient.Clear();
            }
        }
    }
}
