namespace Softaxis.BuildingBlocks.Application.AiEvents;

/// <summary>
/// A business event that AI automations can react to (M4b). Any service publishes one via
/// <see cref="IAiEventBus"/> after a meaningful state change; the AI Assistant service stores it and
/// runs any tenant automation rules whose trigger matches <see cref="EventKey"/>.
/// </summary>
/// <param name="EventKey">Stable dotted key, e.g. "crm.lead.created" (see <see cref="AiEventKeys"/>).</param>
/// <param name="EntityId">The primary entity the event is about, if any (for dedupe / drill-in).</param>
/// <param name="Title">A short human summary, e.g. "New lead: Acme Corp".</param>
/// <param name="PayloadJson">Optional compact JSON with a few useful fields for the model.</param>
public sealed record AiTriggerEvent(
    string EventKey,
    Guid? EntityId = null,
    string? Title = null,
    string? PayloadJson = null);
