using Softaxis.Identity.Domain.Entities;

namespace Softaxis.Identity.Domain.Repositories;

public interface ITenantRepository
{
    Task<Tenant?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<Tenant?> GetBySlugAsync(string slug, CancellationToken ct = default);
    Task<bool>    SlugExistsAsync(string slug, CancellationToken ct = default);
    Task<List<Tenant>> GetAllAsync(CancellationToken ct = default);
    void Add(Tenant tenant);
    void Update(Tenant tenant);
    void Remove(Tenant tenant);
}
