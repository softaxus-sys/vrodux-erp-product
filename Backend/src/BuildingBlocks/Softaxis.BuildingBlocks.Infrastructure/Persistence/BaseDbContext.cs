using MediatR;
using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Domain.Primitives;

namespace Softaxis.BuildingBlocks.Infrastructure.Persistence;

/// <summary>
/// Base DbContext that:
/// - Auto-fills audit timestamps (CreatedAt / UpdatedAt)
/// - Dispatches domain events after SaveChanges
/// - Applies soft-delete filter via query filters (override in derived contexts)
/// </summary>
public abstract class BaseDbContext(DbContextOptions options, IMediator mediator)
    : DbContext(options)
{
    public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        TenantIsolation.StampTenantId(ChangeTracker);
        ApplyAuditInfo();
        var result = await base.SaveChangesAsync(cancellationToken);
        await DispatchDomainEventsAsync(cancellationToken);
        return result;
    }

    // ── Audit ─────────────────────────────────────────────────────────────────

    private void ApplyAuditInfo()
    {
        var now = DateTime.UtcNow;
        foreach (var entry in ChangeTracker.Entries<AuditableEntity<Guid>>())
        {
            switch (entry.State)
            {
                case EntityState.Added:
                    entry.Entity.CreatedAt = now;
                    break;
                case EntityState.Modified:
                    entry.Entity.UpdatedAt = now;
                    break;
                case EntityState.Deleted:
                    entry.State            = EntityState.Modified;
                    entry.Entity.IsDeleted = true;
                    entry.Entity.DeletedAt = now;
                    break;
            }
        }
    }

    // ── Domain Events ─────────────────────────────────────────────────────────

    private async Task DispatchDomainEventsAsync(CancellationToken ct)
    {
        var entities = ChangeTracker
            .Entries<Entity<Guid>>()
            .Select(e => e.Entity)
            .Where(e => e.DomainEvents.Count != 0)
            .ToList();

        var domainEvents = entities.SelectMany(e => e.DomainEvents).ToList();

        entities.ForEach(e => e.ClearDomainEvents());

        foreach (var domainEvent in domainEvents)
            await mediator.Publish(domainEvent, ct);
    }
}
