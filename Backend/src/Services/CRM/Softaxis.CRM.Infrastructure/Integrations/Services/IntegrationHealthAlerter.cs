using System.Net;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Softaxis.BuildingBlocks.Application.Notifications;
using Softaxis.CRM.Application.Abstractions;
using Softaxis.CRM.Domain.Entities.Integrations;
using Softaxis.CRM.Infrastructure.Integrations.Providers.PropertyPortals;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Integrations.Services;

/// <summary>
/// Tells someone when a lead source stops working, and again when it starts working.
///
/// <para><b>Why:</b> an integration going down is silent by nature. Nothing errors, no screen turns
/// red — leads simply stop arriving, and a portal outage looks exactly like a quiet week until
/// somebody eventually notices the pipeline has gone thin. The error was already being recorded on
/// the integration; nobody was ever told to go and look at it.</para>
///
/// <para><b>Never throws.</b> An alert is a side effect of the sweep. A dead SMTP server must not
/// turn a recoverable poll failure into a crashed background service.</para>
/// </summary>
internal interface IIntegrationHealthAlerter
{
    Task AlertFailureAsync(Integration integration, Guid tenantId, string error, Exception? cause, CancellationToken ct);
    Task AlertRecoveryAsync(Integration integration, Guid tenantId, TimeSpan? outage, CancellationToken ct);
}

internal sealed class IntegrationHealthAlerter(
    CrmDbContext db,
    ICrmEmailService email,
    INotificationDispatcher notifications,
    IConfiguration configuration,
    ILogger<IntegrationHealthAlerter> logger) : IIntegrationHealthAlerter
{
    /// <summary>Cap on the fan-out, so a large admin team is not mailed per integration per outage.</summary>
    private const int MaxRecipients = 10;

    public Task AlertFailureAsync(
        Integration integration, Guid tenantId, string error, Exception? cause, CancellationToken ct)
    {
        // A misconfiguration cannot heal itself — saying "we will keep retrying" would be a promise
        // the system cannot keep, and the reader would wait instead of acting.
        var needsHuman = cause is PortalPullConfigurationException;
        var title = $"{integration.Name} is not receiving leads";
        var next  = needsHuman
            ? "Automatic retries cannot fix this — the integration needs its credentials re-entered."
            : "Vrodux will keep retrying on its own, backing off while the problem persists. No action "
              + "is needed unless this is still failing tomorrow.";

        return DispatchAsync(integration, tenantId, NotificationEvents.IntegrationFailing, "error",
            title, $"{Summarise(error)} {next}",
            BuildEmail(integration, title, error, next, ok: false, outage: null), ct);
    }

    public Task AlertRecoveryAsync(
        Integration integration, Guid tenantId, TimeSpan? outage, CancellationToken ct)
    {
        var title = $"{integration.Name} is receiving leads again";
        var body  = outage is { } d
            ? $"It recovered on its own after {Humanise(d)}. Enquiries raised during the outage are picked up "
              + "by this sweep — the portal is re-read from the last successful sync, not from now."
            : "It recovered on its own.";

        return DispatchAsync(integration, tenantId, NotificationEvents.IntegrationRecovered, "success",
            title, body, BuildEmail(integration, title, null, body, ok: true, outage: outage), ct);
    }

    private async Task DispatchAsync(
        Integration integration, Guid tenantId, string eventKey, string type,
        string title, string message, string html, CancellationToken ct)
    {
        try
        {
            var link = $"/settings/integrations?integration={integration.Id}";
            var recipients = await ResolveRecipientsAsync(tenantId, ct);

            if (recipients.Count > 0)
                // TenantId passed explicitly: the poller runs with no ambient tenant, and a
                // NULL-tenant row is invisible to the very people it was raised for.
                await notifications.PublishManyAsync(recipients.Select(r => new NotificationRequest(
                    RecipientUserId: r.UserId,
                    Module:          NotificationModules.Crm,
                    Event:           eventKey,
                    Title:           title,
                    Message:         message,
                    Link:            link,
                    Type:            type,
                    RelatedToType:   "integration",
                    RelatedToId:     integration.Id,
                    TenantId:        tenantId)), ct);

            foreach (var (address, name) in MailTargets(recipients))
                await email.SendAsync(address, name, title, html, ct);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Integration health alert for {Integration} could not be delivered.", integration.Id);
        }
    }

    /// <summary>
    /// Who hears about it: the tenant's own integration administrators, plus any operator addresses
    /// configured for the deployment. The operator list exists because the person who can actually
    /// re-key a portal is often not one of the tenant's users — and during a rollout, nobody inside
    /// the tenant is watching for this at all.
    /// </summary>
    private IEnumerable<(string Address, string Name)> MailTargets(IReadOnlyList<Recipient> recipients)
    {
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var r in recipients)
            if (!string.IsNullOrWhiteSpace(r.Email) && seen.Add(r.Email!))
                yield return (r.Email!, r.Name);

        var configured = configuration["Integrations:AlertEmails"];
        if (string.IsNullOrWhiteSpace(configured)) yield break;

        foreach (var address in configured.Split([',', ';'],
                     StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
            if (seen.Add(address)) yield return (address, "Vrodux operations");
    }

    private sealed record Recipient(Guid UserId, string? Email, string Name);

    private sealed class RecipientRow
    {
        public Guid    UserId    { get; set; }
        public string? Email     { get; set; }
        public string? FirstName { get; set; }
        public string? LastName  { get; set; }
        public string? Username  { get; set; }
    }

    /// <summary>
    /// Role-derived holders of settings.integrations — the same permission that gates the screen
    /// this alert links to, so nobody is sent somewhere they cannot open. "identity" is a reserved
    /// SQL Server keyword and MUST be bracketed. Per-user grants/denies are not applied, matching
    /// the other cross-schema recipient lists in this codebase.
    /// </summary>
    private async Task<IReadOnlyList<Recipient>> ResolveRecipientsAsync(Guid tenantId, CancellationToken ct)
    {
        try
        {
            var rows = await db.Database.SqlQuery<RecipientRow>($@"
                SELECT DISTINCT TOP (25) u.Id AS UserId, u.[email] AS Email, u.FirstName, u.LastName, u.Username
                FROM [identity].[users] u
                JOIN [identity].[user_roles] ur       ON ur.UserId = u.Id
                JOIN [identity].[role_permissions] rp ON rp.RoleId = ur.RoleId
                JOIN [identity].[permissions] p       ON p.Id = rp.PermissionId
                WHERE u.IsDeleted = 0
                  AND u.TenantId = {tenantId}
                  AND p.ModuleId = 'settings.integrations'").ToListAsync(ct);

            return rows.Take(MaxRecipients)
                .Select(r => new Recipient(r.UserId, r.Email, NameOf(r.FirstName, r.LastName, r.Username)))
                .ToList();
        }
        catch (Exception ex)
        {
            // A failure here must not cost the operator email too — that is the one that matters
            // most when a tenant has nobody watching.
            logger.LogWarning(ex, "Integration health alert: could not resolve tenant {Tenant} recipients.", tenantId);
            return [];
        }
    }

    private static string NameOf(string? first, string? last, string? username)
    {
        var name = $"{first} {last}".Trim();
        return name.Length > 0 ? name : username ?? "there";
    }

    /// <summary>One readable sentence from an error that may be several joined slice failures.</summary>
    private static string Summarise(string error)
    {
        var flat = error.Replace('\n', ' ').Replace('\r', ' ').Trim();
        if (flat.Length == 0) return "The last sync failed.";
        if (flat.Length > 180) flat = flat[..180] + "…";
        return flat.EndsWith('.') ? flat : flat + ".";
    }

    private static string Humanise(TimeSpan d) =>
        d.TotalHours   >= 24 ? $"{(int)d.TotalDays} day(s)"
        : d.TotalMinutes >= 60 ? $"{(int)d.TotalHours} hour(s)"
        : $"{Math.Max(1, (int)d.TotalMinutes)} minute(s)";

    /// <summary>
    /// Inline CSS only (mail clients strip stylesheets) and every interpolated value HTML-encoded —
    /// an error body can contain the portal's own HTML login page, which would otherwise render as
    /// markup inside our message.
    /// </summary>
    private string BuildEmail(
        Integration integration, string title, string? error, string next, bool ok, TimeSpan? outage)
    {
        var app  = (configuration["FrontendUrl"] ?? "http://localhost:5173").TrimEnd('/');
        var url  = $"{app}/settings/integrations?integration={integration.Id}";
        var tone = ok ? "#047857" : "#b91c1c";
        var band = ok ? "#ecfdf5" : "#fef2f2";

        var sb = new StringBuilder();
        sb.Append("<div style=\"font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:560px;margin:0 auto;color:#0f172a\">");
        sb.Append($"<div style=\"background:{band};border-left:4px solid {tone};padding:16px 20px;border-radius:6px\">");
        sb.Append($"<h2 style=\"margin:0 0 6px;font-size:17px;color:{tone}\">{E(title)}</h2>");
        sb.Append($"<p style=\"margin:0;font-size:14px;line-height:1.5\">{E(next)}</p></div>");

        sb.Append("<table style=\"width:100%;border-collapse:collapse;margin:20px 0;font-size:13px\">");
        Row(sb, "Integration", integration.Name);
        Row(sb, "Source", integration.ProviderKey);
        Row(sb, "Status", integration.Status);
        Row(sb, "Health", integration.Health);
        Row(sb, "Consecutive failures", integration.RetryCount.ToString());
        Row(sb, "Last successful sync", integration.LastSuccessAt?.ToString("yyyy-MM-dd HH:mm") + (integration.LastSuccessAt is null ? "" : " UTC"));
        Row(sb, "Last attempt", integration.LastSyncAt?.ToString("yyyy-MM-dd HH:mm") + (integration.LastSyncAt is null ? "" : " UTC"));
        if (outage is { } d) Row(sb, "Outage", Humanise(d));
        sb.Append("</table>");

        if (!string.IsNullOrWhiteSpace(error))
        {
            sb.Append("<p style=\"margin:0 0 6px;font-size:13px;font-weight:600\">What the portal returned</p>");
            sb.Append("<pre style=\"background:#0f172a;color:#e2e8f0;padding:12px 14px;border-radius:6px;");
            sb.Append("font-size:12px;line-height:1.5;white-space:pre-wrap;word-break:break-word;margin:0 0 20px\">");
            sb.Append(E(error!)).Append("</pre>");
        }

        sb.Append($"<a href=\"{E(url)}\" style=\"display:inline-block;background:#1d4ed8;color:#fff;");
        sb.Append("padding:10px 18px;border-radius:6px;text-decoration:none;font-size:14px\">Open the integration</a>");
        sb.Append("<p style=\"margin:22px 0 0;font-size:12px;color:#64748b\">");
        sb.Append("Sync History on that screen holds every attempt, successful or not.</p></div>");
        return sb.ToString();
    }

    private static void Row(StringBuilder sb, string label, string? value) =>
        sb.Append($"<tr><td style=\"padding:6px 0;color:#64748b;width:180px\">{E(label)}</td>")
          .Append($"<td style=\"padding:6px 0;font-weight:600\">{E(string.IsNullOrWhiteSpace(value) ? "never" : value!)}</td></tr>");

    private static string E(string value) => WebUtility.HtmlEncode(value);
}
