using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Finance.Application.Tax.Dtos;

namespace Softaxis.Finance.Application.Tax.Queries;

public sealed record GetTaxSummaryQuery : IQuery<TaxSummaryDto>;

public sealed record GetTaxPeriodsQuery : IQuery<IReadOnlyList<TaxPeriodDto>>;

public sealed record GetTaxTransactionsQuery : IQuery<IReadOnlyList<TaxTransactionDto>>;
