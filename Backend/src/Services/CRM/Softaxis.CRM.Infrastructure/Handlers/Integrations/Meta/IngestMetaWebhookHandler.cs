using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.BuildingBlocks.Infrastructure.Persistence;
using Softaxis.CRM.Application.Integrations.Commands;
using Softaxis.CRM.Application.LeadIntake.Abstractions;
using Softaxis.CRM.Domain.Entities.Integrations;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Integrations.Meta;

/// <summary>
/// Anonymous app-level Meta webhook. Verifies the signature (app secret), then fans the payload
/// out by page_id to every matching tenant integration, queuing one inbox row per integration.
/// Runs with an unresolved ambient tenant, so it reads across tenants (filter bypassed) and
/// stamps each inbox row with its integration's tenant.
/// </summary>
internal sealed class IngestMetaWebhookHandler(CrmDbContext db, ILeadProviderRegistry registry)
    : ICommandHandler<IngestMetaWebhookCommand, WebhookAck>
{
    public async Task<Result<WebhookAck>> Handle(IngestMetaWebhookCommand cmd, CancellationToken ct)
    {
        if (registry.Find("meta") is not IWebhookLeadProvider provider)
            return Result.Failure<WebhookAck>(Error.Custom("Webhook.Unsupported", "Meta provider not registered."));

        // Meta signs with the app secret (resolved inside the provider), not a per-integration secret.
        if (!provider.VerifySignature(cmd.RawBody, cmd.Headers, decryptedSecret: null))
            return Result.Failure<WebhookAck>(Error.Custom("Webhook.Unauthorized", "Invalid signature."));

        var pageIds = ExtractPageIds(cmd.RawBody);
        if (pageIds.Count == 0)
            return Result.Success(new WebhookAck(true, null, "No leadgen entries."));

        // All Meta integrations across tenants (anonymous ⇒ tenant filter bypassed).
        var integrations = await db.Integrations.Include(x => x.Resources)
            .Where(x => !x.IsDeleted && x.ProviderKey == "meta")
            .ToListAsync(ct);

        var queued = 0;
        foreach (var integration in integrations)
        {
            var matches = integration.Resources.Any(r => r.ResourceType == "page" && pageIds.Contains(r.ExternalId));
            if (!matches) continue;

            var tenantId = (Guid?)db.Entry(integration).Property(TenantIsolation.Column).CurrentValue;
            var inbox = new RawLeadInbox(integration.Id, "meta", cmd.RawBody, externalId: null);
            if (tenantId is not null) db.Entry(inbox).Property(TenantIsolation.Column).CurrentValue = tenantId;
            db.RawLeadInbox.Add(inbox);
            queued++;
        }

        if (queued > 0) await db.SaveChangesAsync(ct);
        return Result.Success(new WebhookAck(true, null, $"Queued for {queued} integration(s)."));
    }

    private static HashSet<string> ExtractPageIds(string body)
    {
        var ids = new HashSet<string>(StringComparer.Ordinal);
        try
        {
            var root = JsonDocument.Parse(body).RootElement;
            if (!root.TryGetProperty("entry", out var entries) || entries.ValueKind != JsonValueKind.Array) return ids;
            foreach (var entry in entries.EnumerateArray())
            {
                if (entry.TryGetProperty("id", out var id) && id.ValueKind == JsonValueKind.String)
                    ids.Add(id.GetString()!);
                if (entry.TryGetProperty("changes", out var changes) && changes.ValueKind == JsonValueKind.Array)
                    foreach (var ch in changes.EnumerateArray())
                        if (ch.TryGetProperty("value", out var v) && v.TryGetProperty("page_id", out var pid))
                            ids.Add(pid.ValueKind == JsonValueKind.String ? pid.GetString()! : pid.GetRawText());
            }
        }
        catch { /* malformed payload → no matches */ }
        return ids;
    }
}
