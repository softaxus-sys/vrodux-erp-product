using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Application.DTOs;
using Softaxis.POS.Domain.Enums;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Application.Transactions.Queries.GetTransactions;

public sealed class GetTransactionsQueryHandler(IPOSTransactionRepository txnRepo)
    : IQueryHandler<GetTransactionsQuery, PagedResult<POSTransactionSummaryDto>>
{
    public async Task<Result<PagedResult<POSTransactionSummaryDto>>> Handle(
        GetTransactionsQuery query, CancellationToken ct)
    {
        TransactionType?   type   = Enum.TryParse<TransactionType>(query.Type, true, out var t)   ? t : null;
        TransactionStatus? status = Enum.TryParse<TransactionStatus>(query.Status, true, out var s) ? s : null;

        var paged = await txnRepo.GetPagedAsync(
            query.Page, query.PageSize, query.SessionId, query.CashierId, query.CustomerId,
            type, status, query.From, query.To, query.Search, ct);

        var dtos = paged.Items.Select(t => new POSTransactionSummaryDto(
            t.Id, t.TransactionNumber,
            t.Customer?.Name,
            t.Type.ToString(), t.Status.ToString(),
            t.TotalAmount,
            t.Payments.OrderByDescending(p => p.Amount).FirstOrDefault()?.Method.ToString() ?? "None",
            t.CompletedAt)).ToList();

        return Result.Success(PagedResult<POSTransactionSummaryDto>.Create(
            dtos, paged.TotalCount, paged.Page, paged.PageSize));
    }
}
