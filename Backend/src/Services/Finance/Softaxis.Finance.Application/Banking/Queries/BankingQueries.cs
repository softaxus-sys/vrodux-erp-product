using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.Finance.Application.Banking.Dtos;

namespace Softaxis.Finance.Application.Banking.Queries;

public sealed record GetBankingSummaryQuery : IQuery<BankingSummaryDto>;

public sealed record GetBankAccountsQuery : IQuery<IReadOnlyList<BankAccountDto>>;

// A bank feed only ever grows, so the statement list pages in SQL. Search covers description and
// reference — the two things anyone actually looks a transaction up by.
public sealed record GetBankTransactionsQuery(
    Guid?   AccountId  = null,
    string? Type       = null,
    string? Search     = null,
    bool?   Reconciled = null,
    int     Page       = 1,
    int     PageSize   = 30) : IQuery<PagedResult<BankTransactionDto>>;
