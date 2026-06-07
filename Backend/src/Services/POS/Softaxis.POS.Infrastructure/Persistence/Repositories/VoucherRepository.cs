using Microsoft.EntityFrameworkCore;
using Softaxis.POS.Domain.Entities;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Infrastructure.Persistence.Repositories;

public sealed class VoucherRepository(POSDbContext db) : IVoucherRepository
{
    public Task<List<Voucher>> GetAllAsync(CancellationToken ct = default)
        => db.Vouchers.OrderByDescending(v => v.CreatedAt).ToListAsync(ct);

    public Task<Voucher?> GetByIdAsync(Guid id, CancellationToken ct = default)
        => db.Vouchers.FindAsync([id], ct).AsTask();

    public Task<Voucher?> GetByCodeAsync(string code, CancellationToken ct = default)
    {
        var normalized = code.Trim().ToUpperInvariant();
        return db.Vouchers.FirstOrDefaultAsync(v => v.Code == normalized, ct);
    }

    public Task<bool> CodeExistsAsync(string code, Guid? excludeId, CancellationToken ct = default)
    {
        var normalized = code.Trim().ToUpperInvariant();
        return excludeId is null
            ? db.Vouchers.AnyAsync(v => v.Code == normalized, ct)
            : db.Vouchers.AnyAsync(v => v.Code == normalized && v.Id != excludeId, ct);
    }

    public void Add(Voucher voucher)    => db.Vouchers.Add(voucher);
    public void Update(Voucher voucher) => db.Vouchers.Update(voucher);
}
