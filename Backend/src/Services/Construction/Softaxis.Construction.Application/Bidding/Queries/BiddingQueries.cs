using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Construction.Application.Bidding.Dtos;

namespace Softaxis.Construction.Application.Bidding.Queries;

public sealed record GetBiddingSummaryQuery : IQuery<BiddingSummaryDto>;

public sealed record GetRfqsQuery : IQuery<IReadOnlyList<RfqDto>>;

public sealed record GetEstimatesQuery : IQuery<IReadOnlyList<EstimateDto>>;

public sealed record GetContractsQuery : IQuery<IReadOnlyList<ConstructionContractDto>>;
