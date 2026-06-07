using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.POS.Application.DTOs;

namespace Softaxis.POS.Application.Transactions.Queries.GetTransactions;

public sealed record GetTransactionsQuery(
    int       Page       = 1,
    int       PageSize   = 20,
    Guid?     SessionId  = null,
    Guid?     CashierId  = null,
    Guid?     CustomerId = null,
    string?   Type       = null,
    string?   Status     = null,
    DateTime? From       = null,
    DateTime? To         = null,
    string?   Search     = null)
    : IQuery<PagedResult<POSTransactionSummaryDto>>;
