using Microsoft.EntityFrameworkCore;
using Softaxis.CRM.Domain.Entities;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Leads;

/// <summary>
/// Looks up what became of the opportunities that leads converted into.
///
/// <para>A lead's own status stops at <c>converted</c> — win and loss are opportunity outcomes, not
/// lead outcomes, and putting "won" on a lead would blur the line between a person you qualified and
/// money you actually closed. But a converted lead that cannot say what happened next is a dead end,
/// so the resulting deal's stage and value are read here and shown alongside the lead.</para>
///
/// <para>Batched deliberately: one query for the whole page rather than one per lead. The deal id is
/// stored on the lead as a string, so it is parsed once here instead of at every call site.</para>
/// </summary>
internal static class ConvertedDealOutcomes
{
    internal readonly record struct Outcome(string Stage, decimal Value);

    public static async Task<Dictionary<Guid, Outcome>> LoadAsync(
        CrmDbContext db, IEnumerable<Lead> leads, CancellationToken ct)
    {
        var dealIds = leads
            .Select(l => Guid.TryParse(l.ConvertedDealId, out var g) ? g : Guid.Empty)
            .Where(g => g != Guid.Empty)
            .Distinct()
            .ToList();

        if (dealIds.Count == 0) return [];

        // Not access-scoped on purpose: this is the outcome of a deal the caller can already see the
        // ORIGIN of, and only the stage and value are exposed — no owner, no contacts, no notes.
        // Withholding it would leave the lead's own history unreadable to the person working it.
        return await db.Deals.AsNoTracking()
            .Where(d => dealIds.Contains(d.Id) && !d.IsDeleted)
            .Select(d => new { d.Id, d.Stage, d.Value })
            .ToDictionaryAsync(d => d.Id, d => new Outcome(d.Stage, d.Value), ct);
    }

    /// <summary>The outcome for one lead, or nulls when it has not converted (or the deal is gone).</summary>
    public static (string? Stage, decimal? Value) For(
        IReadOnlyDictionary<Guid, Outcome> outcomes, Lead lead)
        => Guid.TryParse(lead.ConvertedDealId, out var id) && outcomes.TryGetValue(id, out var o)
            ? (o.Stage, o.Value)
            : (null, null);
}
