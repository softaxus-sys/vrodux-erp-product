using Softaxis.POS.Domain.Entities;

namespace Softaxis.POS.Domain.Repositories;

public interface ICustomerWalletTransactionRepository
{
    void Add(CustomerWalletTransaction transaction);

    Task<IReadOnlyList<CustomerWalletTransaction>> GetByCustomerAsync(Guid customerId, CancellationToken ct = default);
}
