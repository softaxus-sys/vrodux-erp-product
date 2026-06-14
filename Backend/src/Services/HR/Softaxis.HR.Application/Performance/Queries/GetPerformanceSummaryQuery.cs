using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.HR.Application.Performance.Dtos;

namespace Softaxis.HR.Application.Performance.Queries;

public sealed record GetPerformanceSummaryQuery : IQuery<PerformanceSummaryDto>;
