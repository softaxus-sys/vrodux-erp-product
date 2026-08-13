using Softaxis.Identity.Domain.Entities;

namespace Softaxis.Identity.Domain.Repositories;

public interface ITenantRepository
{
    Task<Tenant?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<Tenant?> GetBySlugAsync(string slug, CancellationToken ct = default);
    Task<bool>    SlugExistsAsync(string slug, CancellationToken ct = default);
    Task<List<Tenant>> GetAllAsync(CancellationToken ct = default);

    /// <summary>
    /// Soft-deleted tenants only — the super-admin recycle bin. Bypasses the global query filter,
    /// which is why it needs its own method rather than a flag on <see cref="GetAllAsync"/>.
    /// </summary>
    Task<List<Tenant>> GetDeletedAsync(CancellationToken ct = default);

    /// <summary>Fetch a tenant even if soft-deleted (for restore / permanent delete).</summary>
    Task<Tenant?> GetByIdIncludingDeletedAsync(Guid id, CancellationToken ct = default);

    void Add(Tenant tenant);
    void Update(Tenant tenant);

    /// <summary>Soft delete — <c>BaseDbContext</c> turns this into <c>IsDeleted = true</c>.</summary>
    void Remove(Tenant tenant);

    /// <summary>
    /// Irreversible hard delete of the tenant and its identity-side records (users, roles, billing
    /// history, audit trail). Only for a super admin purging a soft-deleted tenant; every other
    /// delete path must stay soft so data is recoverable. Commits on its own — it bypasses the
    /// change tracker, so there is nothing left for the unit of work to save.
    /// </summary>
    Task HardDeleteAsync(Tenant tenant, CancellationToken ct = default);
}
