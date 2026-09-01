using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.CRM.Application.Leads.Dtos;

namespace Softaxis.CRM.Application.Leads.Queries;

/// <summary>
/// The complete journey of one lead: creation, every handoff, every status change, every logged
/// activity, and its conversion — merged into one chronological list.
///
/// <para>Newest first, matching how the assignment and activity lists already read. A lead accumulates
/// entries slowly (a handful of handoffs, a dozen activities), so this is deliberately unpaged; if one
/// ever grows past what a drawer can show, page it then rather than pre-emptively.</para>
/// </summary>
public sealed record GetLeadJourneyQuery(Guid LeadId) : IQuery<IReadOnlyList<LeadJourneyEntryDto>>;
