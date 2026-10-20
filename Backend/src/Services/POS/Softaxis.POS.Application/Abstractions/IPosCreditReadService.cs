using Softaxis.POS.Application.Customers.Credit;

namespace Softaxis.POS.Application.Abstractions;

/// <summary>Reads a customer's credit account, and the shop-wide receivables picture, from the ledger.</summary>
public interface IPosCreditReadService
{
    Task<CustomerCreditDto?> GetCustomerAsync(Guid customerId, DateTime todayUtc, CancellationToken ct = default);
    Task<CreditOverviewDto> GetOverviewAsync(DateTime todayUtc, CancellationToken ct = default);
}
