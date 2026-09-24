using Softaxis.POS.Domain.Entities;

namespace Softaxis.POS.Domain.Repositories;

public interface IPaymentMethodConfigRepository
{
    Task<List<PaymentMethodConfig>> GetAllAsync(CancellationToken ct = default);
    Task<PaymentMethodConfig?>      GetByCodeAsync(string code, CancellationToken ct = default);
    Task<PaymentMethodConfig?>      GetByIdAsync(Guid id, CancellationToken ct = default);
    /// <summary>
    /// Gives this tenant its own editable copy of the seeded methods the first time it asks for
    /// them, enabling the ones that suit its country. Returns true if it seeded.
    /// </summary>
    Task<bool> EnsureSeededForTenantAsync(string? country, CancellationToken ct = default);

    void Add(PaymentMethodConfig method);
}
