using Microsoft.Extensions.Logging;
using Softaxis.AiAssistant.Application.Abstractions;
using Softaxis.AiAssistant.Domain.Entities;
using Softaxis.AiAssistant.Infrastructure.Persistence;
using Softaxis.BuildingBlocks.Application.AiEvents;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.BuildingBlocks.Infrastructure.Persistence;

namespace Softaxis.AiAssistant.Infrastructure.Automation;

/// <summary>
/// Durable implementation of <see cref="IAiEventBus"/>: stores one <see cref="AiEventInbox"/> row per
/// event, stamped with the ambient tenant, for the background processor to act on. Best-effort — any
/// failure is swallowed so it never breaks the producer's operation.
///
/// <para><b>Loop guard:</b> when the assistant itself is acting (an <see cref="AiImpersonation"/> scope
/// is active — e.g. an autopilot rule creating a lead), events are NOT recorded, so an automation can't
/// trigger itself in an endless cycle.</para>
/// </summary>
public sealed class AiEventBus(AiAssistantDbContext db, ILogger<AiEventBus> logger) : IAiEventBus
{
    public Task PublishAsync(AiTriggerEvent evt, CancellationToken ct = default)
    {
        // Need a resolved tenant to scope the row; skip anonymous/unresolved contexts.
        if (!TenantAmbient.IsResolved || TenantAmbient.TenantId is not { } tenantId)
            return Task.CompletedTask;
        return PublishAsync(evt, tenantId, ct);
    }

    public async Task PublishAsync(AiTriggerEvent evt, Guid tenantId, CancellationToken ct = default)
    {
        try
        {
            // Don't record events caused by the AI's own autonomous actions (prevents trigger loops).
            if (AiImpersonation.Current is not null) return;
            if (string.IsNullOrWhiteSpace(evt.EventKey)) return;

            var row = new AiEventInbox(evt.EventKey, evt.EntityId, evt.Title, evt.PayloadJson);
            db.EventInbox.Add(row);
            // Stamp the tenant explicitly — SaveChanges' ambient auto-stamp is a no-op when the
            // producer runs outside an authenticated request (webhook intake, background workers).
            db.Entry(row).Property(TenantIsolation.Column).CurrentValue = tenantId;
            await db.SaveChangesAsync(ct);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "AiEventBus: failed to record event {Event}", evt.EventKey);
        }
    }
}
