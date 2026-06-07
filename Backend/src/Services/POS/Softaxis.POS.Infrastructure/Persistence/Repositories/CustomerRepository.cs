using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.POS.Domain.Entities;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Infrastructure.Persistence.Repositories;

public sealed class CustomerRepository(POSDbContext db) : ICustomerRepository
{
    public Task<Customer?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        db.Customers.FirstOrDefaultAsync(c => c.Id == id, ct);

    public Task<Customer?> GetByPhoneAsync(string phone, CancellationToken ct = default) =>
        db.Customers.FirstOrDefaultAsync(c => c.Phone == phone, ct);

    public Task<bool> PhoneExistsAsync(string phone, Guid? excludeId = null, CancellationToken ct = default) =>
        db.Customers.AnyAsync(c =>
            c.Phone == phone && (excludeId == null || c.Id != excludeId), ct);

    public async Task<PagedResult<Customer>> GetPagedAsync(
        int page, int pageSize, string? search = null, CancellationToken ct = default)
    {
        var query = db.Customers.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var pattern = $"%{search.Trim()}%";
            query = query.Where(c =>
                EF.Functions.Like(c.Name, pattern) ||
                (c.Phone != null && EF.Functions.Like(c.Phone, pattern)) ||
                (c.Email != null && EF.Functions.Like(c.Email, pattern)));
        }

        query = query.OrderBy(c => c.Name);
        var total = await query.CountAsync(ct);
        var items = await query.Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(ct);
        return PagedResult<Customer>.Create(items, total, page, pageSize);
    }

    public void Add(Customer customer)    => db.Customers.Add(customer);
    public void Update(Customer customer) => db.Customers.Update(customer);
    public void Remove(Customer customer) => db.Customers.Remove(customer);
}
