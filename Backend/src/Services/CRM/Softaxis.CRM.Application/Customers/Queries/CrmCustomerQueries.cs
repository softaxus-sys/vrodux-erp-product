using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.CRM.Application.Customers.Dtos;

namespace Softaxis.CRM.Application.Customers.Queries;

public sealed record GetCrmCustomersQuery : IQuery<IReadOnlyList<CrmCustomerDto>>;

public sealed record GetCrmCustomerByIdQuery(Guid Id) : IQuery<CrmCustomerDto>;

public sealed record GetCrmCustomersSummaryQuery : IQuery<CrmCustomersSummaryDto>;
