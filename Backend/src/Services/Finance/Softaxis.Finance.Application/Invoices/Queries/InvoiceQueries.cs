using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Finance.Application.Invoices.Dtos;

namespace Softaxis.Finance.Application.Invoices.Queries;

public sealed record GetInvoicesSummaryQuery : IQuery<InvoicesSummaryDto>;

public sealed record GetInvoicesQuery(int Page, int PageSize, string? Search, string? Status) : IQuery<PagedResult<InvoiceSummaryDto>>;

public sealed record GetInvoiceByIdQuery(Guid Id) : IQuery<InvoiceDto>;
