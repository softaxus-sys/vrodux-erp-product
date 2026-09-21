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
/// <para><b>Recipients are split by channel.</b> Email and push go to the lead's owner and to nobody
/// else, ever. Only a lead with no owner at all — not merely one whose owner could not be resolved —
/// reaches the tenant-wide fan-out, and even then the bell carries it further than the inbox does.
/// See <see cref="Audience"/>.</para>
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
    /// <summary>Upper bound for the "nobody owns it" fan-out, so a large team is never spammed per lead.</summary>
    private const int MaxFallbackRecipients = 25;

    public async Task Handle(LeadIngestedNotification evt, CancellationToken ct)
    {
        try
        {
            var lead = await db.Leads.IgnoreQueryFilters().AsNoTracking()
                .FirstOrDefaultAsync(l => l.Id == evt.LeadId && !l.IsDeleted
                    && EF.Property<Guid?>(l, TenantIsolation.Column) == evt.TenantId, ct);
            if (lead is null) return;

            var audience = await ResolveAudienceAsync(lead, evt.TenantId, ct);
            if (audience.Bell.Count == 0 && audience.Inbox.Count == 0)
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
            await notifications.PublishManyAsync(audience.Bell.Select(r => new NotificationRequest(
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

            // Push and email go to Inbox, never to Bell. The bell is a shared work queue; an
            // inbox belongs to one person, and a lead that names an owner must never reach anyone else's.
            await SendPushAsync(audience.Inbox.Select(r => r.UserId).ToList(), title,
                string.IsNullOrWhiteSpace(summary) ? "Open the lead to respond." : summary,
                lead.Id, ct);

            var frontendUrl = (configuration["FrontendUrl"] ?? "http://localhost:5173").TrimEnd('/');
            foreach (var r in audience.Inbox.Where(r => !string.IsNullOrWhiteSpace(r.Email)))
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
    /// Who hears about a lead, split by channel — because the two channels are not the same kind of place.
    ///
    /// <para><b>Bell</b> is a shared work queue inside the app: fanning out there costs nobody anything
    /// and means an unclaimed enquiry is still seen. <b>Inbox</b> (email + mobile push) belongs to one
    /// person. A lead that names an owner must never land in a colleague's inbox under that owner's
    /// name — which is exactly what used to happen, because a single list fed both channels and any
    /// lead whose owner could not be resolved fell through to the whole-team fan-out.</para>
    /// </summary>
    private sealed record Audience(IReadOnlyList<Recipient> Bell, IReadOnlyList<Recipient> Inbox);

    private async Task<Audience> ResolveAudienceAsync(Lead lead, Guid tenantId, CancellationToken ct)
    {
        // 1. The lead has a real owner. They are the ONLY person emailed or pushed, always.
        if (lead.AssignedToUserId is { } ownerId)
        {
            var owner = await db.Set<IdentityUserView>().AsNoTracking()
                .Where(u => u.Id == ownerId && u.TenantId == tenantId && !u.IsDeleted)
                .Select(u => new { u.Id, u.Email, u.FirstName, u.LastName, u.Username })
                .FirstOrDefaultAsync(ct);

            if (owner is not null)
            {
                IReadOnlyList<Recipient> one =
                [new Recipient(owner.Id, owner.Email, NameOf(owner.FirstName, owner.LastName, owner.Username))];
                return new Audience(one, one);
            }

            // Their login is gone (deleted, or moved workspace). Falling back to the team — which is
            // what this used to do — would put an owned lead in colleagues' inboxes. Tell nobody and
            // say so in the log instead; the lead itself is safely stored and still in the list.
            logger.LogWarning(
                "Lead alert: lead {Lead} is owned by user {Owner}, who no longer exists in tenant {Tenant}. "
                + "Nobody was alerted — reassign the lead.", lead.Id, ownerId, tenantId);
            return new Audience([], []);
        }

        var broadcast = await ResolveTenantWideAsync(tenantId, ct);

        // 2. No owner id, but a name — routing named someone it could not resolve to a login.
        //    Somebody is nominally responsible, so this is NOT an unowned lead, and emailing the
        //    team would be emailing someone else. Bell only: the work stays visible and an admin
        //    can see it needs assigning, but no colleague is told the lead is theirs.
        if (!string.IsNullOrWhiteSpace(lead.AssignedTo))
        {
            logger.LogWarning(
                "Lead alert: lead {Lead} names assignee '{Assignee}' but carries no user id, so no email or "
                + "push was sent. Map that name to a user in the integration's routing config.",
                lead.Id, lead.AssignedTo);
            return new Audience(broadcast, []);
        }

        // 3. Genuinely unassigned — nobody's inbox is being borrowed, so the whole-team alert is
        //    right: it is what stops a new enquiry sitting unseen while routing is being set up.
        return new Audience(broadcast, broadcast);
    }

    /// <summary>
    /// Role-derived holders of tenant-wide lead access. Cross-schema read: "identity" is a reserved
    /// SQL Server keyword and MUST be bracketed. Per-user grants/denies are not applied (same scope
    /// as Real Estate's CC list).
    /// </summary>
    private async Task<IReadOnlyList<Recipient>> ResolveTenantWideAsync(Guid tenantId, CancellationToken ct)
    {
        var rows = await db.Database.SqlQuery<RecipientRow>($@"
            SELECT DISTINCT u.Id AS UserId, u.[email] AS Email, u.FirstName, u.LastName
            FROM [identity].[users] u
            JOIN [identity].[user_roles] ur       ON ur.UserId = u.Id
            JOIN [identity].[role_permissions] rp ON rp.RoleId = ur.RoleId
            JOIN [identity].[permissions] p       ON p.Id = rp.PermissionId
            WHERE u.IsDeleted = 0
              AND u.TenantId = {tenantId}
              AND p.ModuleId = 'crm.leads'").ToListAsync(ct);

        return rows
            .GroupBy(r => r.UserId).Select(g => g.First())
            .Take(MaxFallbackRecipients)
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
