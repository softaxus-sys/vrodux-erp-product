using Softaxis.POS.Domain.Entities;

namespace Softaxis.POS.Domain.Repositories;

public interface IPaymentMethodConfigRepository
{
    Task<List<PaymentMethodConfig>> GetAllAsync(CancellationToken ct = default);
    Task<PaymentMethodConfig?>      GetByCodeAsync(string code, CancellationToken ct = default);
    Task<PaymentMethodConfig?>      GetByIdAsync(Guid id, CancellationToken ct = default);
    void Add(PaymentMethodConfig method);
}
