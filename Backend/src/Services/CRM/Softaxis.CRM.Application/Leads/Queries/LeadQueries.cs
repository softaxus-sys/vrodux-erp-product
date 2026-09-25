using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.CRM.Application.Leads.Dtos;

namespace Softaxis.CRM.Application.Leads.Queries;

public sealed record GetLeadsQuery : IQuery<IReadOnlyList<LeadDto>>;

public sealed record GetLeadByIdQuery(Guid Id) : IQuery<LeadDto>;

public sealed record GetLeadsSummaryQuery : IQuery<LeadsSummaryDto>;

public sealed record GetLeadAssignmentsQuery(Guid LeadId) : IQuery<IReadOnlyList<LeadAssignmentDto>>;

/// <summary>
/// The list screen's query: searching, filtering, sorting and paging all happen in SQL.
/// <para>
/// <see cref="GetLeadsQuery"/> returns every lead the caller can see, which is fine for a small
/// tenant and unusable for a large one — a real tenant here holds ~6,000 leads, and shipping them
/// all so the browser could filter them took over ten seconds and sometimes truncated mid-response.
/// It is kept for the callers that genuinely need the whole set (the board view, exports).
/// </para>
/// </summary>
/// <param name="Status">A lead status, or "open" for everything still being worked.</param>
/// <param name="Assignee">An owner user id, or "unassigned".</param>
/// <param name="SortBy">date | score | value.</param>
/// <param name="DateFrom">
/// Inclusive start of a Lead Date window, "yyyy-MM-dd". Filters the SAME column the Lead Date
/// column shows and the "date" sort orders by — so filtering to a day and sorting by date can
/// never disagree about what that day means.
/// </param>
/// <param name="DateTo">
/// Inclusive end of the window, "yyyy-MM-dd". Widened to the end of that calendar day, so passing
/// the same value as <paramref name="DateFrom"/> returns everything from that one day rather than
/// nothing (a bare "&lt;= 2026-03-05" would exclude every lead with a time-of-day component).
/// </param>
public sealed record GetLeadsPagedQuery(
    int     Page     = 1,
    int     PageSize = 25,
    string? Search   = null,
    string? Status   = null,
    string? Source   = null,
    string? Assignee = null,
    string? SortBy   = null,
    bool    SortDesc = true,
    string? DateFrom = null,
    string? DateTo   = null
) : IQuery<PagedResult<LeadDto>>;
