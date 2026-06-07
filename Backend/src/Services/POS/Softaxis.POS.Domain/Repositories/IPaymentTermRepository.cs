using Softaxis.POS.Domain.Entities;

namespace Softaxis.POS.Domain.Repositories;

public interface IPaymentTermRepository
{
    Task<List<PaymentTerm>>  GetAllAsync(CancellationToken ct = default);
    Task<PaymentTerm?>       GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<bool>               CodeExistsAsync(string code, Guid? excludeId, CancellationToken ct = default);
    void Add(PaymentTerm term);
}
