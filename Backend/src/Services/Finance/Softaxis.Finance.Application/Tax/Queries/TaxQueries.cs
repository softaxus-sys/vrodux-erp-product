using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Finance.Application.Tax.Dtos;

namespace Softaxis.Finance.Application.Tax.Queries;

public sealed record GetTaxSummaryQuery : IQuery<TaxSummaryDto>;

public sealed record GetTaxPeriodsQuery : IQuery<IReadOnlyList<TaxPeriodDto>>;

// Period-scoped: the VAT screen reads one period at a time, and without the filter every invoice
// and bill the tenant has ever issued is read on each call.
public sealed record GetTaxTransactionsQuery(string? Period = null) : IQuery<IReadOnlyList<TaxTransactionDto>>;
