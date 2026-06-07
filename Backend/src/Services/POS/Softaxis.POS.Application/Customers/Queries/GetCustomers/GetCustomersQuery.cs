using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.POS.Application.DTOs;

namespace Softaxis.POS.Application.Customers.Queries.GetCustomers;

public sealed record GetCustomersQuery(
    int     Page     = 1,
    int     PageSize = 20,
    string? Search   = null)
    : IQuery<PagedResult<CustomerSummaryDto>>;
