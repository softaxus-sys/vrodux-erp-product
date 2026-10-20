using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Manufacturing.Application.Boms.Dtos;

namespace Softaxis.Manufacturing.Application.Boms.Queries;

public sealed record GetBomsQuery(string? Status = null, string? Search = null, Guid? ProductId = null)
    : IQuery<IReadOnlyList<BomSummaryDto>>;

public sealed record GetBomByIdQuery(Guid Id) : IQuery<BomDto>;
