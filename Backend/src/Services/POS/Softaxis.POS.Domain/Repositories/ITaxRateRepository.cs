using Softaxis.POS.Domain.Entities;

namespace Softaxis.POS.Domain.Repositories;

public interface ITaxRateRepository
{
    Task<List<TaxRate>>  GetAllAsync(CancellationToken ct = default);
    Task<TaxRate?>       GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<bool>           CodeExistsAsync(string code, Guid? excludeId, CancellationToken ct = default);
    void Add(TaxRate taxRate);
}
