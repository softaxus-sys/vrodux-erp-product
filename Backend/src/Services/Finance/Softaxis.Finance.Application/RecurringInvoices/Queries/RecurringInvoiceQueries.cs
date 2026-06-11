using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Finance.Application.RecurringInvoices.Dtos;

namespace Softaxis.Finance.Application.RecurringInvoices.Queries;

public sealed record GetRecurringInvoicesQuery : IQuery<IReadOnlyList<RecurringDto>>;

public sealed record GetRecurringInvoicesSummaryQuery : IQuery<RecurringInvoicesSummaryDto>;

public sealed record GetRecurringInvoiceByIdQuery(Guid Id) : IQuery<RecurringDto>;
