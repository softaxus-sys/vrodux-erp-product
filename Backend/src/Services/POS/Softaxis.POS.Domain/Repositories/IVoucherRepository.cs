using Softaxis.POS.Domain.Entities;

namespace Softaxis.POS.Domain.Repositories;

public interface IVoucherRepository
{
    Task<List<Voucher>> GetAllAsync(CancellationToken ct = default);
    Task<Voucher?>      GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<Voucher?>      GetByCodeAsync(string code, CancellationToken ct = default);
    Task<bool>          CodeExistsAsync(string code, Guid? excludeId, CancellationToken ct = default);
    void Add(Voucher voucher);
    void Update(Voucher voucher);
}
