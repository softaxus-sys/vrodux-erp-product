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

    // IgnoreQueryFilters is required: TenantConfiguration filters out IsDeleted rows, which is
    // exactly what these two need to see.
    public Task<List<Tenant>> GetDeletedAsync(CancellationToken ct = default) =>
        db.Tenants.IgnoreQueryFilters()
                  .AsNoTracking()
                  .Where(t => t.IsDeleted)
                  .OrderByDescending(t => t.DeletedAt)
                  .ToListAsync(ct);

    public Task<Tenant?> GetByIdIncludingDeletedAsync(Guid id, CancellationToken ct = default) =>
        db.Tenants.IgnoreQueryFilters().FirstOrDefaultAsync(t => t.Id == id, ct);

    public void Add(Tenant tenant)    => db.Tenants.Add(tenant);
    public void Update(Tenant tenant) => db.Tenants.Update(tenant);

    /// <summary>Soft delete — BaseDbContext intercepts this and sets IsDeleted instead.</summary>
    public void Remove(Tenant tenant) => db.Tenants.Remove(tenant);

    /// <summary>
    /// True hard delete. BaseDbContext converts EntityState.Deleted into a soft delete, so the only
    /// way to actually remove the row is raw SQL that bypasses the change tracker entirely.
    /// <para>
    /// The tenant's identity-side records have to go first: <c>users.TenantId</c> is a real FK with
    /// <c>ON DELETE RESTRICT</c>, so deleting the tenant row on its own always fails with an FK
    /// violation (every tenant has at least its admin user). The others carry a scalar TenantId with
    /// no FK, so they wouldn't block the delete — they'd just be left orphaned, which is worse.
    /// </para>
    /// <para>
    /// Deleting the users cascades their refresh tokens, role assignments and permission overrides;
    /// deleting the tenant's roles cascades their role_permissions. Legacy global roles
    /// (TenantId NULL) are deliberately untouched. Everything runs in one transaction so a failure
    /// part-way through cannot leave a half-purged tenant.
    /// </para>
    /// <para>
    /// Scope: this clears the tenant's IDENTITY records only. Its business rows in the other module
    /// schemas (crm, hr, finance, …) are keyed by a shadow TenantId with no cross-schema FK and are
    /// NOT removed here — they simply become unreachable. Wiping those is a DBA operation.
    /// </para>
    /// </summary>
    public async Task HardDeleteAsync(Tenant tenant, CancellationToken ct = default)
    {
        var id = tenant.Id;

        await using var tx = await db.Database.BeginTransactionAsync(ct);

        await db.Database.ExecuteSqlAsync($"DELETE FROM [identity].[audit_logs]            WHERE [TenantId] = {id}", ct);
        await db.Database.ExecuteSqlAsync($"DELETE FROM [identity].[subscription_invoices] WHERE [TenantId] = {id}", ct);
        await db.Database.ExecuteSqlAsync($"DELETE FROM [identity].[subscriptions]         WHERE [TenantId] = {id}", ct);
        await db.Database.ExecuteSqlAsync($"DELETE FROM [identity].[users]                 WHERE [TenantId] = {id}", ct);
        await db.Database.ExecuteSqlAsync($"DELETE FROM [identity].[roles]                 WHERE [TenantId] = {id}", ct);
        await db.Database.ExecuteSqlAsync($"DELETE FROM [identity].[tenants]               WHERE [Id]       = {id}", ct);

        await tx.CommitAsync(ct);
    }
}
