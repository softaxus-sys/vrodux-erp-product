using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Construction.Application.Boqs.Dtos;

namespace Softaxis.Construction.Application.Boqs.Queries;

public sealed record GetBoqsQuery : IQuery<IReadOnlyList<BoqDto>>;

public sealed record GetBoqsSummaryQuery : IQuery<BoqsSummaryDto>;
