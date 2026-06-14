using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.RealEstate.Application.Brokers.Dtos;

namespace Softaxis.RealEstate.Application.Brokers.Queries;

public sealed record GetBrokersQuery : IQuery<IReadOnlyList<BrokerDto>>;

public sealed record GetBrokersSummaryQuery : IQuery<BrokersSummaryDto>;
