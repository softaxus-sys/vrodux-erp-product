namespace Softaxis.BuildingBlocks.Application.AiEvents;

/// <summary>
/// The seam producers use to raise an <see cref="AiTriggerEvent"/>. The implementation lives in the AI
/// Assistant service (durable inbox); a no-op fallback is registered so producers never fail if the AI
/// module is absent. Producers depend only on this abstraction — no coupling to the AI service.
/// </summary>
public interface IAiEventBus
{
    /// <summary>Best-effort: record the event for AI automations. Never throws into the caller's path.</summary>
    Task PublishAsync(AiTriggerEvent evt, CancellationToken ct = default);

    /// <summary>
    /// Tenant-explicit variant for producers running outside an authenticated request (anonymous
    /// webhooks, background workers) where the ambient tenant is unresolved and the default overload
    /// would silently skip the event.
    /// </summary>
    Task PublishAsync(AiTriggerEvent evt, Guid tenantId, CancellationToken ct = default);
}

/// <summary>Default no-op bus, used when the AI Assistant service isn't wired in.</summary>
public sealed class NullAiEventBus : IAiEventBus
{
    public Task PublishAsync(AiTriggerEvent evt, CancellationToken ct = default) => Task.CompletedTask;
    public Task PublishAsync(AiTriggerEvent evt, Guid tenantId, CancellationToken ct = default) => Task.CompletedTask;
}
