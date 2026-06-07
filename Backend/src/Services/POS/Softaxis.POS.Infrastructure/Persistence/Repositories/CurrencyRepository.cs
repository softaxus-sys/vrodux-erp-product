using Microsoft.EntityFrameworkCore;
using Softaxis.POS.Domain.Entities;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Infrastructure.Persistence.Repositories;

public sealed class CurrencyRepository(POSDbContext db) : ICurrencyRepository
{
    public Task<List<Currency>> GetAllAsync(CancellationToken ct = default)
        => db.Currencies.OrderBy(c => c.Code).ToListAsync(ct);

    public Task<Currency?> GetByIdAsync(Guid id, CancellationToken ct = default)
        => db.Currencies.FindAsync([id], ct).AsTask();

    public Task<Currency?> GetByCodeAsync(string code, CancellationToken ct = default)
        => db.Currencies.FirstOrDefaultAsync(c => c.Code == code, ct);

    public Task<bool> CodeExistsAsync(string code, Guid? excludeId, CancellationToken ct = default)
        => excludeId is null
            ? db.Currencies.AnyAsync(c => c.Code == code, ct)
            : db.Currencies.AnyAsync(c => c.Code == code && c.Id != excludeId, ct);

    public void Add(Currency currency) => db.Currencies.Add(currency);
}
