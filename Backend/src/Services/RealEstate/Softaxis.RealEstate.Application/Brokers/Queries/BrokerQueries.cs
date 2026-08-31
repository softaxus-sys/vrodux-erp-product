using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.RealEstate.Application.Brokers.Dtos;

namespace Softaxis.RealEstate.Application.Brokers.Queries;

public sealed record GetBrokersQuery(
    string? Search   = null,
    string? Status   = null,
    int     Page     = 1,
    int     PageSize = 30) : IQuery<PagedResult<BrokerDto>>;

public sealed record GetBrokersSummaryQuery : IQuery<BrokersSummaryDto>;
