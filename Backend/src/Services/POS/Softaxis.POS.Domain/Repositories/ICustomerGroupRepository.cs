using Softaxis.POS.Domain.Entities;

namespace Softaxis.POS.Domain.Repositories;

public interface ICustomerGroupRepository
{
    Task<List<CustomerGroup>>  GetAllAsync(CancellationToken ct = default);
    Task<CustomerGroup?>       GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<bool>                 CodeExistsAsync(string code, Guid? excludeId, CancellationToken ct = default);
    void Add(CustomerGroup group);
}
