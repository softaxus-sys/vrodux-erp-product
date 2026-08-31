using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.CRM.Application.Customers.Dtos;

namespace Softaxis.CRM.Application.Customers.Queries;

/// <summary>
/// The accounts list. Search runs in SQL so the account comboboxes (new deal, new visa case) can
/// ask for the few they need rather than pulling every account to filter in the browser.
/// </summary>
public sealed record GetCrmCustomersQuery(
    string? Search   = null,
    string? Status   = null,
    string? Tier     = null,
    int     Page     = 1,
    int     PageSize = 30) : IQuery<PagedResult<CrmCustomerDto>>;

public sealed record GetCrmCustomerByIdQuery(Guid Id) : IQuery<CrmCustomerDto>;

public sealed record GetCrmCustomersSummaryQuery : IQuery<CrmCustomersSummaryDto>;
