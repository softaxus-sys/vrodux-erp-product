using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Leads.Dtos;
using Softaxis.CRM.Application.Leads.Queries;
using Softaxis.CRM.Infrastructure.Persistence;
using Softaxis.CRM.Infrastructure.Services;

namespace Softaxis.CRM.Infrastructure.Handlers.Leads;

/// <summary>
/// Builds a lead's journey by merging the four places its history already lives, rather than writing
/// it to a fifth. Duplicating assignments and activities into a combined event table would let the
/// copy drift from the record it describes; reading them is cheap and cannot disagree.
/// </summary>
internal sealed class GetLeadJourneyHandler(CrmDbContext db, ILeadAccessGuard access)
    : IQueryHandler<GetLeadJourneyQuery, IReadOnlyList<LeadJourneyEntryDto>>
{
    public async Task<Result<IReadOnlyList<LeadJourneyEntryDto>>> Handle(
        GetLeadJourneyQuery query, CancellationToken ct)
    {
        // Same rule as the assignment trail: only reveal the journey of a lead the caller can see, and
        // report NotFound rather than Forbidden so the response never confirms a lead exists.
        var lead = await db.Leads.AsNoTracking().FirstOrDefaultAsync(x => x.Id == query.LeadId, ct);
        if (lead is null || lead.IsDeleted || !await access.CanReadAsync(lead, ct))
            return Result.Failure<IReadOnlyList<LeadJourneyEntryDto>>(Error.NotFoundById("Lead", query.LeadId));

        var entries = new List<LeadJourneyEntryDto>();

        // Where it came from. Captured from the lead itself — there is no row for a lead's own creation.
        entries.Add(new LeadJourneyEntryDto(
            Id: lead.Id, Kind: "created", At: lead.CreatedAt,
            ToValue: lead.Status,
            Title: lead.FullName,
            Detail: string.IsNullOrWhiteSpace(lead.Source) ? null : lead.Source));

        var assignments = await db.LeadAssignments.AsNoTracking()
            .Where(a => a.LeadId == query.LeadId)
            .ToListAsync(ct);

        entries.AddRange(assignments.Select(a => new LeadJourneyEntryDto(
            Id: a.Id, Kind: "assigned", At: a.CreatedAt,
            ActorName: a.AssignedByName, ActorUserId: a.AssignedByUserId,
            FromValue: a.FromUserName, ToValue: a.ToUserName,
            Detail: a.Note)));

        var statuses = await db.LeadStatusHistory.AsNoTracking()
            .Where(h => h.LeadId == query.LeadId)
            .ToListAsync(ct);

        entries.AddRange(statuses.Select(h => new LeadJourneyEntryDto(
            Id: h.Id, Kind: "status", At: h.CreatedAt,
            ActorName: h.ChangedByName, ActorUserId: h.ChangedByUserId,
            FromValue: h.FromStatus, ToValue: h.ToStatus,
            DaysInPrevious: h.DaysInFromStatus)));

        // The tenant filter replaces any entity-level soft-delete filter, so !IsDeleted is applied by
        // hand here — the recurring CRM gotcha.
        var activities = await db.Activities.AsNoTracking()
            .Where(a => a.RelatedToType == "lead" && a.RelatedToId == query.LeadId && !a.IsDeleted)
            .ToListAsync(ct);

        entries.AddRange(activities.Select(a => new LeadJourneyEntryDto(
            Id: a.Id, Kind: "activity", At: a.CreatedAt,
            ActorName: a.AssignedTo,
            ToValue: a.Type,
            Title: a.Subject, Detail: a.Description,
            Completed: a.Completed)));

        if (lead.ConvertedAt is { } convertedAt)
            entries.Add(new LeadJourneyEntryDto(
                Id: lead.Id, Kind: "converted", At: convertedAt,
                ToValue: lead.ConvertedDealId,
                Title: lead.Company));

        // Merged in memory rather than in SQL: a UNION across four differently-shaped tables would need
        // a padded common projection, and one lead's history is small enough that sorting it here costs
        // nothing. Id is the tiebreaker so entries sharing a timestamp — a status change written in the
        // same save as its assignment — keep a stable order between calls.
        var ordered = entries
            .OrderByDescending(e => e.At)
            .ThenByDescending(e => e.Id)
            .ToList();

        return Result.Success<IReadOnlyList<LeadJourneyEntryDto>>(ordered);
    }
}
