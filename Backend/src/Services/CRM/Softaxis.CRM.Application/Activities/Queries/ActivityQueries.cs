using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.CRM.Application.Activities.Dtos;

namespace Softaxis.CRM.Application.Activities.Queries;

public sealed record GetActivitiesQuery(
    string? RelatedToType, Guid? RelatedToId, bool? Completed, string? Type)
    : IQuery<IReadOnlyList<ActivityDto>>;

public sealed record GetActivitiesSummaryQuery : IQuery<ActivitiesSummaryDto>;

/// <summary>
/// The activities list screen: filtering, searching and paging in SQL.
/// <para>
/// <see cref="GetActivitiesQuery"/> is kept for the RECORD-scoped callers — a lead, deal or account
/// drawer passes RelatedToId and gets that record's handful of activities, which is bounded and fine.
/// The unfiltered list is not: it returns every activity the caller can see, already over a thousand
/// on one tenant and growing with every logged call and task.
/// </para>
/// </summary>
public sealed record GetActivitiesPagedQuery(
    int     Page          = 1,
    int     PageSize      = 30,
    string? RelatedToType = null,
    Guid?   RelatedToId   = null,
    bool?   Completed     = null,
    string? Type          = null,
    string? Search        = null,
    // Due-date filters, so the "overdue" and "today" tabs narrow in SQL. Filtering those in the
    // browser only works while the whole list is loaded; under paging it would filter within a
    // single page and silently under-report.
    string? DueBefore     = null,
    string? DueOn         = null
) : IQuery<PagedResult<ActivityDto>>;

/// <summary>
/// Rolled-up activity timeline for an account: the account's own activities plus
/// those of its opportunities and its originating (converted) lead.
/// </summary>
public sealed record GetCustomerTimelineQuery(Guid CustomerId) : IQuery<IReadOnlyList<ActivityDto>>;
