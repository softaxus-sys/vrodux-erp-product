using Microsoft.EntityFrameworkCore;
using Softaxis.POS.Domain.Entities;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Infrastructure.Persistence.Repositories;

public sealed class PaymentGatewayConfigRepository(POSDbContext db) : IPaymentGatewayConfigRepository
{
    public Task<PaymentGatewayConfig?> GetAsync(CancellationToken ct = default) =>
        db.PaymentGatewayConfigs.FirstOrDefaultAsync(ct);

    public void Add(PaymentGatewayConfig config) => db.PaymentGatewayConfigs.Add(config);
    public void Update(PaymentGatewayConfig config) => db.PaymentGatewayConfigs.Update(config);
}
