using Microsoft.EntityFrameworkCore;
using Softaxis.POS.Domain.Entities;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Infrastructure.Persistence.Repositories;

public sealed class CustomerGroupRepository(POSDbContext db) : ICustomerGroupRepository
{
    public Task<List<CustomerGroup>> GetAllAsync(CancellationToken ct = default)
        => db.CustomerGroups.OrderBy(g => g.Name).ToListAsync(ct);

    public Task<CustomerGroup?> GetByIdAsync(Guid id, CancellationToken ct = default)
        => db.CustomerGroups.FindAsync([id], ct).AsTask();

    public Task<bool> CodeExistsAsync(string code, Guid? excludeId, CancellationToken ct = default)
        => excludeId is null
            ? db.CustomerGroups.AnyAsync(g => g.Code == code, ct)
            : db.CustomerGroups.AnyAsync(g => g.Code == code && g.Id != excludeId, ct);

    public void Add(CustomerGroup group) => db.CustomerGroups.Add(group);
}
