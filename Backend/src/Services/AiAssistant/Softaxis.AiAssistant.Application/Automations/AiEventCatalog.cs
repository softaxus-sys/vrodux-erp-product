using Softaxis.BuildingBlocks.Application.AiEvents;

namespace Softaxis.AiAssistant.Application.Automations;

/// <summary>One selectable event-trigger option shown in the automation builder.</summary>
public sealed record AiEventCatalogItem(string Key, string Label, string Description);

/// <summary>
/// The events a tenant can build an event-triggered automation on. Only events that are actually
/// emitted by a producer are listed here — no dead triggers. Grows as more producers are wired.
/// </summary>
public static class AiEventCatalog
{
    public static readonly IReadOnlyList<AiEventCatalogItem> Items = new List<AiEventCatalogItem>
    {
        new(AiEventKeys.CrmLeadCreated,     "New CRM lead",     "Runs when a new lead is created in CRM."),
        new(AiEventKeys.CrmCustomerCreated, "New CRM customer", "Runs when a new customer is created in CRM."),
    };

    public static bool IsKnown(string? key) =>
        key is not null && Items.Any(i => string.Equals(i.Key, key, StringComparison.OrdinalIgnoreCase));
}
