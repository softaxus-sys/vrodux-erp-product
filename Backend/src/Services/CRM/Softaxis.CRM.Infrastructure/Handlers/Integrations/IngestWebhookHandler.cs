using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.BuildingBlocks.Infrastructure.Persistence;
using Softaxis.CRM.Application.Integrations.Commands;
using Softaxis.CRM.Application.LeadIntake.Abstractions;
using Softaxis.CRM.Domain.Entities.Integrations;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Integrations;

/// <summary>
/// Anonymous webhook ingestion. Runs with an unresolved ambient tenant, so it resolves the
/// integration (and its tenant) by inbound key with the query filter bypassed, verifies the
/// payload, then persists to the inbox stamping the tenant explicitly.
/// </summary>
internal sealed class IngestWebhookHandler(
    CrmDbContext db,
    ILeadProviderRegistry registry,
    ISecretProtector protector) : ICommandHandler<IngestWebhookCommand, WebhookAck>
{
    public async Task<Result<WebhookAck>> Handle(IngestWebhookCommand cmd, CancellationToken ct)
    {
        var integration = await db.Integrations
            .FirstOrDefaultAsync(x => x.InboundKey == cmd.InboundKey && !x.IsDeleted, ct);
        if (integration is null)
            return Result.Failure<WebhookAck>(Error.Custom("Webhook.NotFound", "Unknown inbound key."));

        if (registry.Find(integration.ProviderKey) is not IWebhookLeadProvider provider)
            return Result.Failure<WebhookAck>(Error.Custom("Webhook.Unsupported",
                "This integration does not accept inbound payloads."));

        var secret = protector.Unprotect(integration.SigningSecret);
        if (!provider.VerifySignature(cmd.RawBody, cmd.Headers, secret))
            return Result.Failure<WebhookAck>(Error.Custom("Webhook.Unauthorized", "Invalid signature."));

        var tenantId = (Guid?)db.Entry(integration).Property(TenantIsolation.Column).CurrentValue;
        if (tenantId is null)
            return Result.Failure<WebhookAck>(Error.Custom("Webhook.Conflict",
                "Integration is not attached to a tenant."));

        var inbox = new RawLeadInbox(integration.Id, integration.ProviderKey, cmd.RawBody, externalId: null);
        db.Entry(inbox).Property(TenantIsolation.Column).CurrentValue = tenantId;

        db.RawLeadInbox.Add(inbox);
        await db.SaveChangesAsync(ct);

        return Result.Success(new WebhookAck(true, inbox.Id, "Accepted."));
    }
}
