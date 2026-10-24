using Microsoft.Extensions.Options;
using Softaxis.BuildingBlocks.Application.Notifications;
using Softaxis.BuildingBlocks.Infrastructure.Sync.Branch;

namespace Softaxis.ApiGateway.Sync;

/// <summary>
/// On the cloud: tells head office when a branch server goes silent for <c>BranchSync:AlertAfterMinutes</c>
/// (default 10), and again when it comes back. One alert per outage - the "told" mark is stored in
/// <see cref="BranchStatusStore"/>, so a cloud restart neither repeats it nor forgets it.
/// Recipients: everyone whose role grants <c>settings.branches.edit</c> in that workspace (bell + realtime).
/// </summary>
internal sealed class BranchHealthAlerter(
    IServiceScopeFactory scopes, IOptions<BranchSyncOptions> options, BranchStatusStore statusStore, BranchKeyStore keyStore,
    ILogger<BranchHealthAlerter> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var o = options.Value;
        if (!o.IsCloud) return;

        // Give branches time to reconnect after a cloud restart before judging them.
        try { await Task.Delay(TimeSpan.FromMinutes(Math.Max(1, o.AlertAfterMinutes)), stoppingToken); }
        catch (OperationCanceledException) { return; }

        while (!stoppingToken.IsCancellationRequested)
        {
            try { await PassAsync(o, stoppingToken); }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "Branch health: a pass failed.");
            }
            try { await Task.Delay(TimeSpan.FromSeconds(60), stoppingToken); }
            catch (OperationCanceledException) { break; }
        }
    }

    private async Task PassAsync(BranchSyncOptions o, CancellationToken ct)
    {
        var rows = (await statusStore.ReadAsync(null, ct)).ToDictionary(r => r.BranchId);
        var silentAfter = TimeSpan.FromMinutes(Math.Max(1, o.AlertAfterMinutes));

        // Branches with a key in configuration or an active issued key.
        var watched = o.Branches.Select(b => (b.BranchId, b.TenantId))
            .Concat((await keyStore.ListAsync(null, activeOnly: true, ct)).Select(k => (k.BranchId, k.TenantId)))
            .Distinct().Select(x => new BranchCredential { BranchId = x.BranchId, TenantId = x.TenantId }).ToList();
        foreach (var cred in watched)
        {
            rows.TryGetValue(cred.BranchId, out var s);
            var lastSeen = BranchHealth.LastSeen(cred.BranchId, s);
            if (lastSeen is null) continue;                  // never connected: nothing to report as "lost"
            var silent = DateTime.UtcNow - lastSeen > silentAfter;
            var told = s?.OfflineAlertAt is not null;

            if (silent && !told)
            {
                await NotifyAsync(cred, "branch-server.offline", "warning", "A branch server is offline",
                    $"Not heard from for {BranchHealth.Ago(lastSeen.Value)}. The branch keeps trading; its sales arrive when it reconnects. " +
                    "QR and Foodpanda orders are refused for it meanwhile.", ct);
                await statusStore.SetOfflineAlertAsync(cred.BranchId, cred.TenantId, DateTime.UtcNow, ct);
            }
            else if (!silent && told)
            {
                await NotifyAsync(cred, "branch-server.online", "success", "A branch server is back online",
                    $"Reconnected after being offline since {s!.OfflineAlertAt:u}. Its sales are catching up.", ct);
                await statusStore.SetOfflineAlertAsync(cred.BranchId, cred.TenantId, null, ct);
            }
        }
    }

    private async Task NotifyAsync(BranchCredential cred, string evt, string type, string title, string message, CancellationToken ct)
    {
        using var scope = scopes.CreateScope();
        var recipients = scope.ServiceProvider.GetService<INotificationRecipients>();
        var dispatcher = scope.ServiceProvider.GetService<INotificationDispatcher>();
        if (recipients is null || dispatcher is null) { logger.LogWarning("Branch health: {Title} ({Branch}) - notifications are not available.", title, cred.BranchId); return; }

        var people = await recipients.WithPermissionAsync(cred.TenantId, "settings.branches.edit", ct);
        var name = await BranchNameAsync(scope, cred.BranchId, ct);
        await dispatcher.PublishManyAsync(people.Select(u => new NotificationRequest(
            u, NotificationModules.System, evt, $"{title}: {name}", message, "/settings/branch-servers", type,
            "branch", cred.BranchId, cred.TenantId)), ct);
        logger.LogInformation("Branch health: {Title} - {Branch}, {N} recipient(s).", title, name, people.Count);
    }

    private static async Task<string> BranchNameAsync(IServiceScope scope, Guid branchId, CancellationToken ct)
    {
        try
        {
            var cs = scope.ServiceProvider.GetRequiredService<IConfiguration>().GetConnectionString("IdentityDb");
            await using var conn = new Microsoft.Data.SqlClient.SqlConnection(cs);
            await conn.OpenAsync(ct);
            await using var cmd = conn.CreateCommand();
            cmd.CommandText = "SELECT Name FROM [identity].[branches] WHERE Id = @b";
            cmd.Parameters.Add(new Microsoft.Data.SqlClient.SqlParameter("@b", branchId));
            return (await cmd.ExecuteScalarAsync(ct)) as string ?? "branch";
        }
        catch { return "branch"; }
    }
}
