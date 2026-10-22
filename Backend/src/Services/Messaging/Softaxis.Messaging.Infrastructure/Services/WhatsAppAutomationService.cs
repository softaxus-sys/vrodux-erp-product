using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Softaxis.BuildingBlocks.Application.Multitenancy;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.Messaging.Application.WhatsApp;
using Softaxis.Messaging.Domain.Entities;
using Softaxis.Messaging.Infrastructure.Persistence;

namespace Softaxis.Messaging.Infrastructure.Services;

/// <summary>
/// Sends automation templates for records created in other modules. Reads those modules' tables
/// (never writes them) and keeps its own watermark, so no other module had to change.
/// Records that existed before an automation was switched on are never messaged.
/// </summary>
public sealed class WhatsAppAutomationService(IServiceScopeFactory scopes, ILogger<WhatsAppAutomationService> log)
    : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromMinutes(2);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Never on the startup path: the deploy's health window must not wait for this.
        try { await Task.Delay(TimeSpan.FromMinutes(3), stoppingToken); } catch (OperationCanceledException) { return; }

        while (!stoppingToken.IsCancellationRequested)
        {
            try { await RunOnceAsync(stoppingToken); }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested) { log.LogError(ex, "WhatsApp automation pass failed"); }

            try { await Task.Delay(Interval, stoppingToken); } catch (OperationCanceledException) { return; }
        }
    }

    private async Task RunOnceAsync(CancellationToken ct)
    {
        List<Guid> tenants;
        using (var scope = scopes.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<MessagingDbContext>();
            tenants = await db.Automations.IgnoreQueryFilters()
                .Where(a => a.Enabled && a.EventKey == WaEvents.LeadCreated)
                .Select(a => EF.Property<Guid?>(a, "TenantId"))
                .Where(t => t != null).Select(t => t!.Value).Distinct().ToListAsync(ct);
        }

        foreach (var tenantId in tenants)
        {
            using var scope = scopes.CreateScope();
            try
            {
                if (!await scope.ServiceProvider.GetRequiredService<ITenantWorkFilter>().ShouldProcessAsync(tenantId, ct)) continue;
                TenantAmbient.Set(tenantId, isSuperAdmin: false, isResolved: true);
                await RunLeadsAsync(scope.ServiceProvider, tenantId, ct);
            }
            catch (Exception ex) { log.LogError(ex, "WhatsApp automation failed for workspace {Tenant}", tenantId); }
            finally { TenantAmbient.Clear(); }
        }
    }

    private sealed class LeadRow
    {
        public Guid     Id           { get; set; }
        public string   FirstName    { get; set; } = "";
        public string   LastName     { get; set; } = "";
        public string   Company      { get; set; } = "";
        public string?  InterestedIn { get; set; }
        public string   Source       { get; set; } = "";
        public string   AssignedTo   { get; set; } = "";
        public string   Phone        { get; set; } = "";
        public string?  WhatsApp     { get; set; }
        public DateTime CreatedAt    { get; set; }
    }

    private static async Task RunLeadsAsync(IServiceProvider sp, Guid tenantId, CancellationToken ct)
    {
        var db = sp.GetRequiredService<MessagingDbContext>();
        var sender = sp.GetRequiredService<IWhatsAppSender>();

        var automation = await db.Automations.FirstOrDefaultAsync(a => a.EventKey == WaEvents.LeadCreated && a.Enabled, ct);
        if (automation?.TemplateName is null || automation.Watermark is null) return;
        if (!await db.Connections.AnyAsync(c => c.Status == WaConnectionStatus.Connected, ct)) return;

        var since = automation.Watermark.Value;
        var rows = await db.Database.SqlQuery<LeadRow>($"""
            SELECT TOP 50 Id, FirstName, LastName, Company, InterestedIn, Source, AssignedTo, Phone, WhatsApp, CreatedAt
            FROM [crm].[leads]
            WHERE TenantId = {tenantId} AND IsDeleted = 0 AND CreatedAt > {since}
            ORDER BY CreatedAt
            """).ToListAsync(ct);

        var fields = automation.VariableFields.Length == 0 ? [] : automation.VariableFields.Split('|');
        foreach (var r in rows)
        {
            automation.Advance(r.CreatedAt);
            // A lead that came in over WhatsApp has already been greeted by the auto-reply.
            if (string.Equals(r.Source, "whatsapp", StringComparison.OrdinalIgnoreCase)) continue;
            var to = string.IsNullOrWhiteSpace(r.WhatsApp) ? r.Phone : r.WhatsApp;
            if (string.IsNullOrWhiteSpace(to)) continue;

            var values = fields.Select(f => f switch
            {
                "firstName"    => r.FirstName,
                "lastName"     => r.LastName,
                "fullName"     => $"{r.FirstName} {r.LastName}".Trim(),
                "company"      => r.Company,
                "interestedIn" => r.InterestedIn ?? "",
                "source"       => r.Source,
                "assignedTo"   => r.AssignedTo,
                _              => "",
            }).ToList();

            var name = $"{r.FirstName} {r.LastName}".Trim();
            // Failures are logged on the message row and shown in the inbox; they never stop the batch.
            await sender.SendAsync(new WaSendRequest(to, null, automation.TemplateName, automation.Language, values,
                WaOrigin.Automation, "lead", r.Id, name, name, null, "Automation"), ct);
        }

        if (rows.Count > 0) await db.SaveChangesAsync(ct);
    }
}
