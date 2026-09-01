using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Application.DTOs;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Application.Customers.Queries.GetWalletTransactions;

public sealed class GetWalletTransactionsQueryHandler(ICustomerWalletTransactionRepository walletRepo)
    : IQueryHandler<GetWalletTransactionsQuery, PagedResult<CustomerWalletTransactionDto>>
{
    public async Task<Result<PagedResult<CustomerWalletTransactionDto>>> Handle(
        GetWalletTransactionsQuery query, CancellationToken ct)
    {
        var (items, total) = await walletRepo.GetByCustomerPagedAsync(
            query.CustomerId, query.Page, query.PageSize, ct);

        var dtos = items
            .Select(t => new CustomerWalletTransactionDto(t.Id, t.CustomerId, t.Type, t.Amount, t.OrderId, t.Notes, t.CreatedAt))
            .ToList();

        return Result.Success(PagedResult<CustomerWalletTransactionDto>.Create(
            dtos, total, query.Page, query.PageSize));
    }
}
