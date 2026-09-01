using Softaxis.POS.Domain.Entities;

namespace Softaxis.POS.Domain.Repositories;

public interface ICustomerWalletTransactionRepository
{
    void Add(CustomerWalletTransaction transaction);

    /// <summary>One page of a customer's wallet ledger, newest first, with the total count.</summary>
    Task<(IReadOnlyList<CustomerWalletTransaction> Items, int Total)> GetByCustomerPagedAsync(
        Guid customerId, int page, int pageSize, CancellationToken ct = default);
}
