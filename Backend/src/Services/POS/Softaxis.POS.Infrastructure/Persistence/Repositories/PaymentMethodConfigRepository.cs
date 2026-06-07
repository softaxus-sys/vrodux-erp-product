using Microsoft.EntityFrameworkCore;
using Softaxis.POS.Domain.Entities;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Infrastructure.Persistence.Repositories;

public sealed class PaymentMethodConfigRepository(POSDbContext db)
    : IPaymentMethodConfigRepository
{
    public Task<List<PaymentMethodConfig>> GetAllAsync(CancellationToken ct = default)
        => db.PaymentMethodConfigs
             .OrderBy(m => m.SortOrder)
             .ThenBy(m => m.Code)
             .ToListAsync(ct);

    public Task<PaymentMethodConfig?> GetByCodeAsync(string code, CancellationToken ct = default)
        => db.PaymentMethodConfigs
             .FirstOrDefaultAsync(m => m.Code == code, ct);

    public Task<PaymentMethodConfig?> GetByIdAsync(Guid id, CancellationToken ct = default)
        => db.PaymentMethodConfigs
             .FindAsync([id], ct)
             .AsTask();

    public void Add(PaymentMethodConfig method)
        => db.PaymentMethodConfigs.Add(method);
}
