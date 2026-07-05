using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.CRM.Application.Activities.Dtos;

namespace Softaxis.CRM.Application.Activities.Queries;

public sealed record GetActivitiesQuery(
    string? RelatedToType, Guid? RelatedToId, bool? Completed, string? Type)
    : IQuery<IReadOnlyList<ActivityDto>>;

public sealed record GetActivitiesSummaryQuery : IQuery<ActivitiesSummaryDto>;

/// <summary>
/// Rolled-up activity timeline for an account: the account's own activities plus
/// those of its opportunities and its originating (converted) lead.
/// </summary>
public sealed record GetCustomerTimelineQuery(Guid CustomerId) : IQuery<IReadOnlyList<ActivityDto>>;
