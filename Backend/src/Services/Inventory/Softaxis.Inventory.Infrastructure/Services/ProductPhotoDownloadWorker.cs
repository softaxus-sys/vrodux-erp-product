using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Softaxis.BuildingBlocks.Application.Multitenancy;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.BuildingBlocks.Infrastructure.Net;
using Softaxis.Inventory.Application.ProductPhotos;
using Softaxis.Inventory.Application.ProductTemplates;
using Softaxis.Inventory.Domain.Entities;
using Softaxis.Inventory.Infrastructure.Persistence;

namespace Softaxis.Inventory.Infrastructure.Services;

/// <summary>
/// Downloads the pictures an import file pointed at and attaches each to its stock item, a few at a time.
///
/// Starts a minute after the app is up, not before: every MigrateAndSeed* runs awaited before the host serves
/// requests, and anything slow on that path delays /health and can trip the deploy's health window.
/// </summary>
internal sealed class ProductPhotoDownloadWorker(
    IServiceScopeFactory scopeFactory,
    IConfiguration configuration,
    ILogger<ProductPhotoDownloadWorker> logger) : BackgroundService
{
    private static readonly TimeSpan StartupDelay = TimeSpan.FromMinutes(1);
    private static readonly TimeSpan BusyTick = TimeSpan.FromSeconds(5);
    private static readonly TimeSpan IdleTick = TimeSpan.FromSeconds(30);
    private const int PerWorkspacePerPass = 8;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try { await Task.Delay(StartupDelay, stoppingToken); }
        catch (OperationCanceledException) { return; }

        while (!stoppingToken.IsCancellationRequested)
        {
            var didWork = false;
            // One workspace's bad picture must never stop another's, and an unhandled exception would end
            // the worker for the life of the process.
            try { didWork = await PassAsync(stoppingToken); }
            catch (Exception ex) { logger.LogError(ex, "Picture download pass failed."); }

            try { await Task.Delay(didWork ? BusyTick : IdleTick, stoppingToken); }
            catch (OperationCanceledException) { return; }
        }
    }

    private async Task<bool> PassAsync(CancellationToken ct)
    {
        List<Guid> tenants;
        using (var scope = scopeFactory.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<InventoryDbContext>();
            var now = DateTime.UtcNow;
            // No ambient tenant here, so the global filter would hide everything; the shadow column is read by name.
            tenants = await db.PendingProductPhotos.IgnoreQueryFilters()
                .Where(p => p.Status == PendingProductPhoto.Pending && p.NextAttemptAt <= now)
                .Select(p => EF.Property<Guid?>(p, "TenantId"))
                .Where(t => t != null).Select(t => t!.Value).Distinct().ToListAsync(ct);
        }
        if (tenants.Count == 0) return false;

        var allowPrivate = string.Equals(configuration["ASPNETCORE_ENVIRONMENT"], "Development", StringComparison.OrdinalIgnoreCase)
                           && configuration.GetValue<bool>("Inventory:AllowPrivateImageUrls");
        var worked = false;

        foreach (var tenantId in tenants)
        {
            if (ct.IsCancellationRequested) break;
            // A fresh scope per workspace: the DbContext is scoped and would carry the last tenant's entities along.
            using var scope = scopeFactory.CreateScope();
            try
            {
                var filter = scope.ServiceProvider.GetService<ITenantWorkFilter>();
                if (filter is not null && !await filter.ShouldProcessAsync(tenantId, ct)) continue;

                TenantAmbient.Set(tenantId, isSuperAdmin: false, isResolved: true);
                var db = scope.ServiceProvider.GetRequiredService<InventoryDbContext>();
                var sender = scope.ServiceProvider.GetRequiredService<ISender>();
                var downloader = scope.ServiceProvider.GetRequiredService<SafeImageDownloader>();

                var now = DateTime.UtcNow;
                var batch = await db.PendingProductPhotos
                    .Where(p => p.Status == PendingProductPhoto.Pending && p.NextAttemptAt <= now)
                    .OrderBy(p => p.CreatedAt).ThenBy(p => p.Position).Take(PerWorkspacePerPass).ToListAsync(ct);

                foreach (var item in batch)
                {
                    await ProcessOneAsync(db, sender, downloader, item, allowPrivate, ct);
                    worked = true;
                }
            }
            catch (Exception ex) { logger.LogError(ex, "Picture downloads failed for workspace {TenantId}.", tenantId); }
            finally { TenantAmbient.Clear(); }
        }
        return worked;
    }

    private static async Task ProcessOneAsync(
        InventoryDbContext db, ISender sender, SafeImageDownloader downloader, PendingProductPhoto item, bool allowPrivate, CancellationToken ct)
    {
        var got = await downloader.DownloadAsync(item.Url, allowPrivate, ct);
        if (!got.Ok)
        {
            // A missing page or a non-picture will not get better; a busy or slow site might.
            var retryable = got.Error!.Contains("too long") || got.Error.Contains("error (5") || got.Error.Contains("could not be found")
                            || got.Error.Contains("connection", StringComparison.OrdinalIgnoreCase);
            item.MarkAttemptFailed(got.Error!, retryable);
            await db.SaveChangesAsync(ct);
            return;
        }

        var data = $"data:{got.ContentType};base64,{Convert.ToBase64String(got.Bytes!)}";
        var result = await sender.Send(new AddProductPhotosCommand(item.ProductId, [new ProductImageInput(data, got.FileName)]), ct);

        if (result.IsSuccess) item.MarkDone();
        else item.MarkAttemptFailed(result.Error.Description, retryable: false);
        await db.SaveChangesAsync(ct);
    }
}
