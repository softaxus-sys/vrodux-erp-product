using Microsoft.Extensions.Configuration;
using Softaxis.BuildingBlocks.Application.Notifications;
using Softaxis.BuildingBlocks.Application.Sync;
using Softaxis.Identity.Application.Abstractions;
using Softaxis.Identity.Domain.Repositories;

namespace Softaxis.ApiGateway.Sync;

/// <summary>
/// Announces a broken nightly push, and its recovery.
///
/// <para>
/// Lives in the gateway because it needs email and the notification store; BuildingBlocks declares
/// the interface and stays out of it.
/// </para>
///
/// <para>
/// <b>Twice per outage, not once per attempt.</b> On the first failure, and again when it reaches
/// the escalation threshold. The scheduler retries three times a night and then every night after,
/// so alerting on each one would send a message a day for a week - and a channel that repeats itself
/// is one people filter, exactly when it next matters. Same policy as the portal-integration alerts.
/// </para>
/// </summary>
public sealed class SyncAlerter(
    INotificationDispatcher  notifications,
    INotificationRecipients  recipients,
    IEmailService            email,
    ITenantRepository        tenants,
    IConfiguration           configuration,
    ILogger<SyncAlerter>     logger) : ISyncAlerter
{
    /// <summary>
    /// The failure count at which it is clearly not a passing blip. Three attempts is one bad night
    /// plus its retries; announcing again there distinguishes "the link hiccuped" from "this has
    /// been down since Friday".
    /// </summary>
    private const int EscalationThreshold = 3;

    public async Task FailedAsync(Guid tenantId, int consecutiveFailures, string error, CancellationToken ct = default)
    {
        if (consecutiveFailures is not (1 or EscalationThreshold)) return;

        var workspace = await WorkspaceNameAsync(tenantId, ct);

        await NotifyInAppAsync(tenantId,
            "sync.failed",
            consecutiveFailures == 1 ? "Cloud sync failed last night" : "Cloud sync is still failing",
            $"The push to the cloud copy has failed {consecutiveFailures} time(s). Trading is unaffected; " +
            "the cloud copy is not being updated. " + Trim(error),
            "warning", ct);

        await EmailOperatorsAsync(workspace, recovered: false, consecutiveFailures, error, ct);
    }

    public async Task RecoveredAsync(Guid tenantId, int previousFailures, CancellationToken ct = default)
    {
        // Only tell people who were told it broke. An all-clear for an alarm nobody heard is noise.
        if (previousFailures < 1) return;

        var workspace = await WorkspaceNameAsync(tenantId, ct);

        await NotifyInAppAsync(tenantId,
            "sync.recovered",
            "Cloud sync is working again",
            $"The push completed after {previousFailures} failed attempt(s). The cloud copy is up to date.",
            "success", ct);

        await EmailOperatorsAsync(workspace, recovered: true, previousFailures, null, ct);
    }

    // ── Channels ──────────────────────────────────────────────────────────────

    /// <summary>
    /// In-app, to whoever administers this installation. Gated on the same permission that opens the
    /// Cloud Sync screen, so nobody is alerted about something they cannot go and look at.
    /// </summary>
    private async Task NotifyInAppAsync(
        Guid tenantId, string evt, string title, string message, string type, CancellationToken ct)
    {
        var people = await recipients.WithPermissionAsync(tenantId, "settings.integrations.edit", ct);
        if (people.Count == 0) return;

        await notifications.PublishManyAsync(
            people.Select(id => new NotificationRequest(
                RecipientUserId: id,
                Module:          "settings",
                Event:           evt,
                Title:           title,
                Message:         message,
                Link:            "/settings/cloud-sync",
                Type:            type,
                TenantId:        tenantId)),
            ct);
    }

    /// <summary>
    /// Email to the operator addresses in <c>Sync:AlertEmails</c>. Deliberately not the shop's own
    /// users: the person who can re-key a licence or fix a firewall is usually not one of them, and
    /// the in-app alert already covers the people on site.
    /// </summary>
    private async Task EmailOperatorsAsync(
        string workspace, bool recovered, int failures, string? error, CancellationToken ct)
    {
        var configured = configuration["Sync:AlertEmails"];
        if (string.IsNullOrWhiteSpace(configured)) return;

        var addresses = configured
            .Split([',', ';'], StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Distinct(StringComparer.OrdinalIgnoreCase);

        foreach (var address in addresses)
        {
            try
            {
                var sent = await email.SendSyncAlertAsync(address, workspace, recovered, failures, error, ct);
                if (!sent)
                    logger.LogWarning("Sync: alert to {Address} was not sent - SMTP is not configured.", address);
            }
            catch (Exception ex)
            {
                // One bad address must not stop the others, and no alert failure may fail the run.
                logger.LogError(ex, "Sync: could not email the alert to {Address}.", address);
            }
        }
    }

    private async Task<string> WorkspaceNameAsync(Guid tenantId, CancellationToken ct)
    {
        try { return (await tenants.GetByIdAsync(tenantId, ct))?.Name ?? "this installation"; }
        catch { return "this installation"; }
    }

    private static string Trim(string s) => s.Length > 300 ? s[..300] : s;
}
