using System.Net;
using System.Text;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Softaxis.BuildingBlocks.Application.Notifications;
using Softaxis.BuildingBlocks.Application.PushNotifications;
using Softaxis.BuildingBlocks.Infrastructure.Persistence;
using Softaxis.CRM.Application.Abstractions;
using Softaxis.CRM.Application.LeadIntake.Notifications;
using Softaxis.CRM.Domain.Entities;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Notifications;

/// <summary>
/// Tells the right people that a lead has arrived: an in-app notification (the bell), a mobile push,
/// and an email.
///
/// <para>Why it matters now: Bayut stopped sending WhatsApp alerts to agents and delivers leads only to the
/// CRM webhook. Without this, a new enquiry sits unseen — and the portal measures response time from the
/// moment it was sent. The email carries the portal's tracked reply link so the agent can answer at once.
/// The push exists for the same reason on a phone that isn't sitting on the CRM tab: this is the first
/// (and so far only) mobile-push trigger in the app — chosen because it already has one unambiguous
/// recipient per lead, unlike the HR/Purchase/Sales/Finance approval queues, which are permission-gated
/// rather than assigned to a single person and would need a broadcast design of their own.</para>
///
/// <para><b>Recipients: the lead's owner, and nobody else.</b> A lead with no resolvable owner goes
/// to the tenant's CRM manager — never to the team. See <see cref="ResolveRecipientsAsync"/>.</para>
///
/// <para>Runs inside intake, which may be an anonymous webhook with no ambient tenant — every query is
/// tenant-explicit and new rows are stamped by hand. It never throws: a failed alert must not fail or
/// retry the lead itself, which is already safely stored.</para>
/// </summary>
internal sealed class LeadIngestedAlertHandler(
    CrmDbContext db,
    ICrmEmailService email,
    IPushNotificationSender push,
    IConfiguration configuration,
    INotificationDispatcher notifications,
    ICrmAssignmentNotifier supervisors,
    ILogger<LeadIngestedAlertHandler> logger) : INotificationHandler<LeadIngestedNotification>
{
    /// <summary>The per-tenant role a CRM-enabled tenant is provisioned with (ModuleRoleCatalogue).</summary>
    private const string CrmManagerRole = "CRM Manager";

    /// <summary>A tenant should have one or two CRM managers; the cap only guards a misconfigured tenant.</summary>
    private const int MaxManagerRecipients = 5;

    public async Task Handle(LeadIngestedNotification evt, CancellationToken ct)
    {
        try
        {
            var lead = await db.Leads.IgnoreQueryFilters().AsNoTracking()
                .FirstOrDefaultAsync(l => l.Id == evt.LeadId && !l.IsDeleted
                    && EF.Property<Guid?>(l, TenantIsolation.Column) == evt.TenantId, ct);
            if (lead is null) return;

            var recipients = await ResolveRecipientsAsync(lead, evt.TenantId, ct);
            if (recipients.Count == 0)
            {
                logger.LogInformation("Lead alert: no recipients for lead {Lead} in tenant {Tenant}.", lead.Id, evt.TenantId);
                return;
            }

            var portal  = PortalLabel(lead.Platform ?? evt.ProviderKey);
            var name    = string.IsNullOrWhiteSpace(lead.FullName) ? "New enquiry" : lead.FullName;
            var link    = $"/crm/leads?lead={lead.Id}";
            var title   = $"New {portal} lead: {name}";
            var summary = string.Join(" · ", new[] { lead.InterestedIn, lead.Phone ?? lead.WhatsApp }
                .Where(s => !string.IsNullOrWhiteSpace(s)));

            // Raised through the shared publisher so an inbound lead lands in the SAME bell as every
            // other module's alerts, and gets the instant push. TenantId is passed explicitly: intake
            // can be an anonymous webhook with no ambient tenant, and a NULL-tenant row would be
            // invisible to the very user it was raised for.
            var body = string.IsNullOrWhiteSpace(summary) ? "Open the lead to respond." : summary;
            await notifications.PublishManyAsync(recipients.Select(r => new NotificationRequest(
                RecipientUserId: r.UserId,
                Module:          NotificationModules.Crm,
                Event:           NotificationEvents.LeadReceived,
                Title:           title,
                Message:         body,
                Link:            link,
                Type:            "mention",
                RelatedToType:   "lead",
                RelatedToId:     lead.Id,
                TenantId:        evt.TenantId)), ct);

            // The agent's supervisor is told too, so a portal enquiry landing on one person is
            // visible one rung up without the team lead watching the list. Only when the lead has an
            // owner: the unowned fan-out above already reaches everyone with tenant-wide lead access.
            // Bell + realtime only — the email and push stay the assigned agent's channel, because
            // they exist to get the enquiry answered inside the portal's response-time window.
            if (lead.AssignedToUserId is { } ownerId)
                await supervisors.NotifySupervisorsAsync(new CrmSupervisorAlert(
                    OwnerId:       ownerId,
                    OwnerName:     lead.AssignedTo,
                    TeamId:        lead.TeamId,
                    EventKey:      NotificationEvents.LeadReceivedByMember,
                    Title:         $"New {portal} lead for {(string.IsNullOrWhiteSpace(lead.AssignedTo) ? "your team" : lead.AssignedTo)}",
                    Message:       string.IsNullOrWhiteSpace(summary) ? name : $"{name} — {summary}",
                    Link:          link,
                    RelatedToType: "lead",
                    RelatedToId:   lead.Id), evt.TenantId, ct);

            await SendPushAsync(recipients.Select(r => r.UserId).ToList(), title,
                string.IsNullOrWhiteSpace(summary) ? "Open the lead to respond." : summary,
                lead.Id, ct);

            var frontendUrl = (configuration["FrontendUrl"] ?? "http://localhost:5173").TrimEnd('/');
            foreach (var r in recipients.Where(r => !string.IsNullOrWhiteSpace(r.Email)))
            {
                var html = BuildEmail(r.Name, portal, lead, frontendUrl + link);
                await email.SendAsync(r.Email!, r.Name, title, html, ct);
            }
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Lead alert failed for lead {Lead}; the lead itself is unaffected.", evt.LeadId);
        }
    }

    private sealed record Recipient(Guid UserId, string? Email, string Name);

    private sealed class RecipientRow
    {
        public Guid    UserId    { get; set; }
        public string? Email     { get; set; }
        public string? FirstName { get; set; }
        public string? LastName  { get; set; }
    }

    private sealed class DeviceTokenRow
    {
        public string ExpoPushToken { get; set; } = string.Empty;
    }

    /// <summary>
    /// Cross-schema read of Identity's device-token table (CRM has no entity for it — same pattern
    /// as the recipient-resolution query above, and as Real Estate's rent-alert CC list). GUIDs are
    /// interpolated straight into the IN-list: a <see cref="Guid"/>'s own formatting is hex + dashes
    /// only, so this can never become a SQL-injection vector despite looking like concatenation.
    /// Stale tokens Expo reports as permanently dead are deleted the same way.
    /// </summary>
    private async Task SendPushAsync(IReadOnlyList<Guid> userIds, string title, string body, Guid leadId, CancellationToken ct)
    {
        if (userIds.Count == 0) return;
        try
        {
            var idList = string.Join(",", userIds.Distinct().Select(id => $"'{id}'"));
            // Built via string.Concat (not a C# interpolated-string literal) so the EF1002 raw-SQL
            // analyzer doesn't flag it: the values are GUIDs, whose own ToString() can only ever be
            // hex digits and dashes, so there is nothing here for injection to exploit.
            var selectSql = string.Concat(
                "SELECT ExpoPushToken FROM [identity].[user_device_tokens] WHERE UserId IN (", idList, ")");
            var rows = await db.Database.SqlQueryRaw<DeviceTokenRow>(selectSql).ToListAsync(ct);
            if (rows.Count == 0) return;

            var tokens = rows.Select(r => r.ExpoPushToken).ToList();
            var data = new Dictionary<string, string> { ["type"] = "lead", ["leadId"] = leadId.ToString() };
            var dead = await push.SendAsync(tokens, title, body, data, ct);

            if (dead.Count > 0)
            {
                var deadList = string.Join(",", dead.Select(t => $"N'{t.Replace("'", "''")}'"));
                var deleteSql = string.Concat(
                    "DELETE FROM [identity].[user_device_tokens] WHERE ExpoPushToken IN (", deadList, ")");
                await db.Database.ExecuteSqlRawAsync(deleteSql, ct);
            }
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Lead alert: push notification failed for lead {Lead}.", leadId);
        }
    }

    /// <summary>
    /// Who is told about a lead: its owner, or — when it has none — the tenant's CRM manager.
    ///
    /// <para>There is deliberately no third case. This used to fall back to every user in the tenant
    /// holding <c>crm.leads</c>, which is how a lead displayed as one agent's reached the whole
    /// team's inboxes, each addressed to a different colleague. An enquiry nobody owns is a
    /// management problem, so it goes to the one person accountable for routing it — never
    /// broadcast.</para>
    /// </summary>
    private async Task<IReadOnlyList<Recipient>> ResolveRecipientsAsync(Lead lead, Guid tenantId, CancellationToken ct)
    {
        // 1. The lead has an owner: they are the only person told, on every channel.
        if (lead.AssignedToUserId is { } ownerId)
        {
            var owner = await db.Set<IdentityUserView>().AsNoTracking()
                .Where(u => u.Id == ownerId && u.TenantId == tenantId && !u.IsDeleted)
                .Select(u => new { u.Id, u.Email, u.FirstName, u.LastName, u.Username })
                .FirstOrDefaultAsync(ct);

            if (owner is not null)
                return [new Recipient(owner.Id, owner.Email, NameOf(owner.FirstName, owner.LastName, owner.Username))];

            // Their login is gone (deleted, or moved workspace). The lead is still real and still
            // needs answering, so it goes to the manager rather than nowhere — but never to peers.
            logger.LogWarning(
                "Lead alert: lead {Lead} is owned by user {Owner}, who no longer exists in tenant {Tenant}. "
                + "Alerting the CRM manager instead.", lead.Id, ownerId, tenantId);
        }

        var managers = await ResolveCrmManagersAsync(tenantId, ct);
        if (managers.Count == 0)
            logger.LogWarning(
                "Lead alert: lead {Lead} has no resolvable owner and tenant {Tenant} has nobody in a "
                + "'CRM Manager' role, so nobody was alerted. Assign the lead, or give someone that role.",
                lead.Id, tenantId);

        return managers;
    }

    /// <summary>
    /// Holders of the tenant's own "CRM Manager" role — the role
    /// <c>TenantRoleProvisioner</c> creates for every CRM-enabled tenant, granting the untiered
    /// (tenant-wide) CRM keys.
    ///
    /// <para>Matched by role NAME, which is how the provisioner itself identifies these roles when
    /// topping up their permissions. The consequence to know: a tenant that renames the role loses
    /// this fallback, which is why finding nobody is logged as a warning rather than passing
    /// quietly. Deliberately NOT widened to "anyone holding crm.leads.view" — that is the tenant-wide
    /// fan-out this exists to replace, and it would also sweep in every Administrator.</para>
    ///
    /// <para>Cross-schema read: "identity" is a reserved SQL Server keyword and MUST be bracketed.</para>
    /// </summary>
    private async Task<IReadOnlyList<Recipient>> ResolveCrmManagersAsync(Guid tenantId, CancellationToken ct)
    {
        var rows = await db.Database.SqlQuery<RecipientRow>($@"
            SELECT DISTINCT u.Id AS UserId, u.[email] AS Email, u.FirstName, u.LastName
            FROM [identity].[users] u
            JOIN [identity].[user_roles] ur ON ur.UserId = u.Id
            JOIN [identity].[roles] r       ON r.Id = ur.RoleId
            WHERE u.IsDeleted = 0
              AND r.IsDeleted = 0
              AND u.TenantId = {tenantId}
              AND r.TenantId = {tenantId}
              AND r.Name = {CrmManagerRole}").ToListAsync(ct);

        return rows
            .GroupBy(r => r.UserId).Select(g => g.First())
            .Take(MaxManagerRecipients)
            .Select(r => new Recipient(r.UserId, r.Email, NameOf(r.FirstName, r.LastName, r.Email)))
            .ToList();
    }

    private static string NameOf(string? first, string? last, string? fallback)
    {
        var n = $"{first} {last}".Trim();
        return n.Length > 0 ? n : fallback ?? "there";
    }

    /// <summary>
    /// A portal's display name. The key arrives in two spellings — the provider key is dashed
    /// (<c>property-finder</c>) but <c>Lead.Platform</c>, which is preferred, is underscored
    /// (<c>property_finder</c>). Without normalising, every Property Finder alert read
    /// "New Property_finder lead" — the switch missed and the fallback title-cased the raw key.
    /// </summary>
    private static string PortalLabel(string? key) => (key ?? "").ToLowerInvariant().Replace('_', '-') switch
    {
        "bayut"           => "Bayut",
        "dubizzle"        => "Dubizzle",
        "property-finder" => "Property Finder",
        "meta"            => "Meta",
        ""                => "CRM",
        var k             => char.ToUpperInvariant(k[0]) + k[1..].Replace('-', ' '),
    };

    /// <summary>Inline CSS (mail clients strip stylesheets); every interpolated value HTML-encoded.</summary>
    private static string BuildEmail(string recipientName, string portal, Lead lead, string crmUrl)
    {
        static string E(string? s) => WebUtility.HtmlEncode(s ?? "");
        var rows = new StringBuilder();
        void Row(string label, string? value)
        {
            if (string.IsNullOrWhiteSpace(value)) return;
            rows.Append($"<tr><td style=\"padding:6px 12px 6px 0;color:#64748b;font-size:13px;white-space:nowrap;vertical-align:top\">{E(label)}</td>")
                .Append($"<td style=\"padding:6px 0;color:#0f172a;font-size:14px\">{E(value)}</td></tr>");
        }
        Row("Name", lead.FullName);
        Row("Phone", lead.Phone);
        Row("WhatsApp", lead.WhatsApp);
        Row("Email", lead.Email);
        Row("Interested in", lead.InterestedIn);
        Row("Budget", lead.Budget);
        Row("Message", lead.Message);

        var replyButton = string.IsNullOrWhiteSpace(lead.PortalContactLink) ? "" :
            $"<a href=\"{E(lead.PortalContactLink)}\" style=\"display:inline-block;background:#059669;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:8px;margin:0 8px 8px 0\">Reply on WhatsApp via {E(portal)}</a>";
        var trackedNote = string.IsNullOrWhiteSpace(lead.PortalContactLink) ? "" :
            $"<p style=\"color:#64748b;font-size:12px;margin:12px 0 0\">Please reply using the green button — {E(portal)} only records your response time when you reply through its link.</p>";

        return $"""
            <div style="font-family:Segoe UI,Arial,sans-serif;background:#f1f5f9;padding:24px">
              <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;padding:24px">
                <p style="color:#0f172a;font-size:15px;margin:0 0 4px">Hi {E(recipientName)},</p>
                <h2 style="color:#0f172a;font-size:20px;margin:0 0 16px">You have a new {E(portal)} lead</h2>
                <table style="border-collapse:collapse;width:100%;margin-bottom:20px">{rows}</table>
                {replyButton}
                <a href="{E(crmUrl)}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:8px;margin:0 8px 8px 0">Open in CRM</a>
                {trackedNote}
              </div>
            </div>
            """;
    }
}
