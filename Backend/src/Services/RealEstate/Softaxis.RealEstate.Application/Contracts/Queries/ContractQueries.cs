using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.RealEstate.Application.Contracts.Dtos;

namespace Softaxis.RealEstate.Application.Contracts.Queries;

public sealed record GetContractsQuery : IQuery<IReadOnlyList<ContractDto>>;

public sealed record GetContractsSummaryQuery : IQuery<ContractsSummaryDto>;
