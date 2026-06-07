using Microsoft.EntityFrameworkCore;
using Softaxis.Identity.Domain.Entities;
using Softaxis.Identity.Domain.Repositories;

namespace Softaxis.Identity.Infrastructure.Persistence.Repositories;

public sealed class TenantRepository(IdentityDbContext db) : ITenantRepository
{
    public Task<Tenant?> GetByIdAsync(Guid id, CancellationToken ct = default) =>
        db.Tenants.FirstOrDefaultAsync(t => t.Id == id, ct);

    public Task<Tenant?> GetBySlugAsync(string slug, CancellationToken ct = default) =>
        db.Tenants.FirstOrDefaultAsync(t => t.Slug == slug.ToLowerInvariant(), ct);

    public Task<bool> SlugExistsAsync(string slug, CancellationToken ct = default) =>
        db.Tenants.AnyAsync(t => t.Slug == slug.ToLowerInvariant(), ct);

    public Task<List<Tenant>> GetAllAsync(CancellationToken ct = default) =>
        db.Tenants.AsNoTracking().OrderBy(t => t.Name).ToListAsync(ct);

    public void Add(Tenant tenant)    => db.Tenants.Add(tenant);
    public void Update(Tenant tenant) => db.Tenants.Update(tenant);
    public void Remove(Tenant tenant) => db.Tenants.Remove(tenant);
}
