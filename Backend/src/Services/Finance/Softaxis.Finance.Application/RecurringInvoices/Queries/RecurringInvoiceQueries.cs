using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.Finance.Application.RecurringInvoices.Dtos;

namespace Softaxis.Finance.Application.RecurringInvoices.Queries;

// One template per client contract, so this scales with the customer base (a property manager
// running 500 leases has 500 templates) - it pages in SQL.
public sealed record GetRecurringInvoicesQuery(
    string? Search   = null,
    bool?   IsActive = null,
    int     Page     = 1,
    int     PageSize = 30) : IQuery<PagedResult<RecurringDto>>;

public sealed record GetRecurringInvoicesSummaryQuery : IQuery<RecurringInvoicesSummaryDto>;

public sealed record GetRecurringInvoiceByIdQuery(Guid Id) : IQuery<RecurringDto>;
