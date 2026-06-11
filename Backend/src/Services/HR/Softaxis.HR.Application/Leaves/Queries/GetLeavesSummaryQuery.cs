using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.HR.Application.Leaves.Dtos;

namespace Softaxis.HR.Application.Leaves.Queries;

public sealed record GetLeavesSummaryQuery : IQuery<LeavesSummaryDto>;
