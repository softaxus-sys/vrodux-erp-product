namespace Softaxis.BuildingBlocks.Application.Notifications;

/// <summary>
/// One alert, for one person, raised by any module.
///
/// <para><b>Why a shared record rather than a per-module type:</b> the bell is one list. If each
/// module shaped its own alert the panel would need a mapper per module and every new module would
/// mean touching the frontend. Everything the UI needs to render, route and filter an alert lives
/// here, so a new trigger is one <see cref="INotificationDispatcher"/> call and nothing else.</para>
/// </summary>
/// <param name="RecipientUserId">The person this is for. One row per recipient — read state is per person.</param>
/// <param name="Module">
/// Module key (<see cref="NotificationModules"/>), e.g. "crm". Drives the icon/colour in the panel AND
/// the access gate: the feed hides alerts for modules the reader can no longer open, so losing access
/// to a module also hides its history rather than leaving orphaned rows visible.
/// </param>
/// <param name="Event">
/// Stable dotted key, e.g. "lead.assigned" (<see cref="NotificationEvents"/>). Used for grouping and
/// per-user muting. Kept separate from <paramref name="Title"/> because the title is prose that will
/// be reworded or translated, and a filter must not break when it is.
/// </param>
/// <param name="Link">App-relative path the alert opens, e.g. <c>/crm/leads?lead={id}</c>.</param>
/// <param name="Type">Panel styling bucket: info | success | warning | error | mention.</param>
/// <param name="TenantId">
/// Set ONLY from a context with no ambient tenant (background job, anonymous webhook). Left null, the
/// row is stamped from the ambient tenant as usual. A NULL-tenant row is invisible to the very user it
/// was raised for, so background callers must pass this.
/// </param>
/// <param name="ActorUserId">
/// Whoever performed the action. The publisher drops a request whose recipient IS the actor — nobody
/// wants to be told about what they just did themselves, and it is easier to enforce in one place than
/// to remember at every call site.
/// </param>
public sealed record NotificationRequest(
    Guid    RecipientUserId,
    string  Module,
    string  Event,
    string  Title,
    string  Message,
    string? Link          = null,
    string  Type          = "info",
    string? RelatedToType = null,
    Guid?   RelatedToId   = null,
    Guid?   TenantId      = null,
    Guid?   ActorUserId   = null);
