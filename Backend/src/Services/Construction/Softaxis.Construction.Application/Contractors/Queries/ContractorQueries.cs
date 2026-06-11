using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Construction.Application.Contractors.Dtos;

namespace Softaxis.Construction.Application.Contractors.Queries;

public sealed record GetContractorsQuery : IQuery<IReadOnlyList<ContractorDto>>;

public sealed record GetContractorsSummaryQuery : IQuery<ContractorsSummaryDto>;
