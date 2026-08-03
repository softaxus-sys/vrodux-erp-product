using Softaxis.POS.Domain.Entities;

namespace Softaxis.POS.Domain.Repositories;

/// <summary>Singleton-per-tenant config, same shape as any other repository so the handler doesn't
/// need to know about EF — GetAsync returns null when the tenant hasn't configured anything yet.</summary>
public interface IPaymentGatewayConfigRepository
{
    Task<PaymentGatewayConfig?> GetAsync(CancellationToken ct = default);
    void Add(PaymentGatewayConfig config);
    void Update(PaymentGatewayConfig config);
}
