using Microsoft.EntityFrameworkCore;
using Softaxis.POS.Domain.Entities;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Infrastructure.Persistence.Repositories;

public sealed class TaxRateRepository(POSDbContext db) : ITaxRateRepository
{
    public Task<List<TaxRate>> GetAllAsync(CancellationToken ct = default)
        => db.TaxRates.OrderBy(t => t.Rate).ThenBy(t => t.Name).ToListAsync(ct);

    public Task<TaxRate?> GetByIdAsync(Guid id, CancellationToken ct = default)
        => db.TaxRates.FindAsync([id], ct).AsTask();

    public Task<bool> CodeExistsAsync(string code, Guid? excludeId, CancellationToken ct = default)
        => excludeId is null
            ? db.TaxRates.AnyAsync(t => t.Code == code, ct)
            : db.TaxRates.AnyAsync(t => t.Code == code && t.Id != excludeId, ct);

    public void Add(TaxRate taxRate) => db.TaxRates.Add(taxRate);
}
