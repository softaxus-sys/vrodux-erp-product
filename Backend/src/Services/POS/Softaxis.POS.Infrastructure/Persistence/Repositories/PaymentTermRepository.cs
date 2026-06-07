using Microsoft.EntityFrameworkCore;
using Softaxis.POS.Domain.Entities;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Infrastructure.Persistence.Repositories;

public sealed class PaymentTermRepository(POSDbContext db) : IPaymentTermRepository
{
    public Task<List<PaymentTerm>> GetAllAsync(CancellationToken ct = default)
        => db.PaymentTerms.OrderBy(p => p.DaysNet).ThenBy(p => p.Name).ToListAsync(ct);

    public Task<PaymentTerm?> GetByIdAsync(Guid id, CancellationToken ct = default)
        => db.PaymentTerms.FindAsync([id], ct).AsTask();

    public Task<bool> CodeExistsAsync(string code, Guid? excludeId, CancellationToken ct = default)
        => excludeId is null
            ? db.PaymentTerms.AnyAsync(p => p.Code == code, ct)
            : db.PaymentTerms.AnyAsync(p => p.Code == code && p.Id != excludeId, ct);

    public void Add(PaymentTerm term) => db.PaymentTerms.Add(term);
}
