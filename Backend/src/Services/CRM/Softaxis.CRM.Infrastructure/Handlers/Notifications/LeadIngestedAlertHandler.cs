using System.Net;
using System.Text;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Softaxis.BuildingBlocks.Infrastructure.Persistence;
using Softaxis.CRM.Application.Abstractions;
using Softaxis.CRM.Application.LeadIntake.Notifications;
using Softaxis.CRM.Domain.Entities;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Notifications;

/// <summary>
/// Tells the right people that a lead has arrived: an in-app notification (the bell) and an email.
///
/// <para>Why it matters now: Bayut stopped sending WhatsApp alerts to agents and delivers leads only to the
/// CRM webhook. Without this, a new enquiry sits unseen — and the portal measures response time from the
/// moment it was sent. The email carries the portal's tracked reply link so the agent can answer at once.</para>
///
/// <para>Recipients: the lead's owner. An unowned lead goes to everyone holding tenant-wide lead access
/// (role-derived), so nothing falls through the cracks while routing is being set up.</para>
///
/// <para>Runs inside intake, which may be an anonymous webhook with no ambient tenant — every query is
/// tenant-explicit and new rows are stamped by hand. It never throws: a failed alert must not fail or
/// retry the lead itself, which is already safely stored.</para>
/// </summary>
internal sealed class LeadIngestedAlertHandler(
    CrmDbContext db,
    ICrmEmailService email,
    IConfiguration configuration,
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

            var recipients = await ResolveRecipientsAsync(lead.AssignedToUserId, evt.TenantId, ct);
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

            foreach (var r in recipients)
            {
                var n = new CrmNotification(r.UserId, "mention", title,
                    string.IsNullOrWhiteSpace(summary) ? "Open the lead to respond." : summary,
                    link, "lead", lead.Id);
                db.Notifications.Add(n);
                // Webhook contexts have no ambient tenant, so SaveChanges would leave this NULL —
                // and a NULL-tenant row is invisible to the very user it is for.
                db.Entry(n).Property(TenantIsolation.Column).CurrentValue = evt.TenantId;
            }
            await db.SaveChangesAsync(ct);

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

    private async Task<List<Recipient>> ResolveRecipientsAsync(Guid? ownerId, Guid tenantId, CancellationToken ct)
    {
        if (ownerId is { } id)
        {
            var owner = await db.Set<IdentityUserView>().AsNoTracking()
                .Where(u => u.Id == id && u.TenantId == tenantId && !u.IsDeleted)
                .Select(u => new { u.Id, u.Email, u.FirstName, u.LastName, u.Username })
                .FirstOrDefaultAsync(ct);
            if (owner is not null)
                return [new Recipient(owner.Id, owner.Email, NameOf(owner.FirstName, owner.LastName, owner.Username))];
        }

        // Cross-schema read of role-derived tenant-wide lead access. "identity" is a reserved SQL Server
        // keyword and MUST be bracketed. Per-user grants/denies are not applied (same scope as Real Estate's CC list).
        var rows = await db.Database.SqlQuery<RecipientRow>($@"
            SELECT DISTINCT u.Id AS UserId, u.[email] AS Email, u.FirstName, u.LastName
            FROM [identity].[users] u
            JOIN [identity].[user_roles] ur       ON ur.UserId = u.Id
            JOIN [identity].[role_permissions] rp ON rp.RoleId = ur.RoleId
            JOIN [identity].[permissions] p       ON p.Id = rp.PermissionId
            WHERE u.IsDeleted = 0
              AND u.TenantId = {tenantId}
              AND p.Module = 'crm.leads'").ToListAsync(ct);

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

    private static string PortalLabel(string? key) => (key ?? "").ToLowerInvariant() switch
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
