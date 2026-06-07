using Softaxis.POS.Domain.Entities;

namespace Softaxis.POS.Domain.Repositories;

public interface ICurrencyRepository
{
    Task<List<Currency>>  GetAllAsync(CancellationToken ct = default);
    Task<Currency?>       GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<Currency?>       GetByCodeAsync(string code, CancellationToken ct = default);
    Task<bool>            CodeExistsAsync(string code, Guid? excludeId, CancellationToken ct = default);
    void Add(Currency currency);
}
