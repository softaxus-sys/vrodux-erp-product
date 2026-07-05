using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.CRM.Application.Deals.Dtos;

namespace Softaxis.CRM.Application.Deals.Queries;

public sealed record GetDealsQuery(Guid? CustomerId = null) : IQuery<IReadOnlyList<DealDto>>;

public sealed record GetDealByIdQuery(Guid Id) : IQuery<DealDto>;

public sealed record GetDealsSummaryQuery : IQuery<DealsSummaryDto>;
