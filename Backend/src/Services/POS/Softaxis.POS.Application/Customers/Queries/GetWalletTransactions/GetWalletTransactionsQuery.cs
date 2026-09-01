using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.POS.Application.DTOs;

namespace Softaxis.POS.Application.Customers.Queries.GetWalletTransactions;

/// <summary>
/// A customer's wallet ledger. Every top-up and every spend appends a row and none are ever removed,
/// so a regular's history outgrows a drawer quickly — paged in SQL rather than fetched whole.
/// </summary>
public sealed record GetWalletTransactionsQuery(
    Guid CustomerId,
    int  Page     = 1,
    int  PageSize = 30) : IQuery<PagedResult<CustomerWalletTransactionDto>>;
