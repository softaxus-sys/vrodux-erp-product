using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Hospitality.Application.Housekeeping.Dtos;

namespace Softaxis.Hospitality.Application.Housekeeping.Queries;

public sealed record GetHousekeepingSummaryQuery : IQuery<HousekeepingSummaryDto>;

public sealed record GetHousekeepingTasksQuery : IQuery<IReadOnlyList<HousekeepingTaskDto>>;
