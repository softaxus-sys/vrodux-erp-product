namespace Softaxis.CRM.Application.Leads.Dtos;

/// <summary>
/// One entry in a lead's journey — the merged, chronological record of everything that happened to it.
///
/// <para>Deliberately a single flat shape rather than a union per source: the point of the journey is
/// that an owner reads it top to bottom without having to reconcile four different lists. The
/// <c>Kind</c> tells the UI which icon and wording to use; the optional fields carry whatever that
/// kind needs and are null for the rest.</para>
/// </summary>
/// <param name="Kind">created | assigned | status | activity | converted</param>
/// <param name="ActorName">Who did it, where that is known. Automated intake has no actor.</param>
/// <param name="DaysInPrevious">
/// For a status change: how long the lead sat in the status it just left. Stored at write time, so it
/// is null for transitions that predate the history table rather than being guessed after the fact.
/// </param>
public sealed record LeadJourneyEntryDto(
    Guid      Id,
    string    Kind,
    DateTime  At,
    string?   ActorName    = null,
    Guid?     ActorUserId  = null,
    string?   FromValue    = null,
    string?   ToValue      = null,
    string?   Title        = null,
    string?   Detail       = null,
    int?      DaysInPrevious = null,
    bool?     Completed    = null);
