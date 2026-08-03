using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Application.DTOs;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Application.Customers.Queries.GetWalletTransactions;

public sealed class GetWalletTransactionsQueryHandler(ICustomerWalletTransactionRepository walletRepo)
    : IQueryHandler<GetWalletTransactionsQuery, IReadOnlyList<CustomerWalletTransactionDto>>
{
    public async Task<Result<IReadOnlyList<CustomerWalletTransactionDto>>> Handle(GetWalletTransactionsQuery query, CancellationToken ct)
    {
        var items = await walletRepo.GetByCustomerAsync(query.CustomerId, ct);

        IReadOnlyList<CustomerWalletTransactionDto> dtos = items
            .Select(t => new CustomerWalletTransactionDto(t.Id, t.CustomerId, t.Type, t.Amount, t.OrderId, t.Notes, t.CreatedAt))
            .ToList();

        return Result.Success(dtos);
    }
}
