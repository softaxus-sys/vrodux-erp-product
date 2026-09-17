using Microsoft.EntityFrameworkCore;
using Softaxis.Support.Domain.Entities;

namespace Softaxis.Support.Infrastructure.Persistence;

/// <summary>
/// Deliberately NOT tenant-isolated via <c>TenantIsolation.ApplyTenantId</c> — support tickets
/// are, by their nature, a cross-tenant concern: any tenant's user can raise one, and only
/// Softaxis's own operator-tenant agents work the combined queue. Applying the platform's usual
/// ambient-tenant shadow column + global query filter here would do the opposite of what this
/// schema needs — it would stamp every new ticket with the REQUESTER's tenant id and then only
/// ever let that same tenant's ambient context read it back, making the whole queue invisible to
/// every Softaxis agent (who are, correctly, in a *different* tenant).
///
/// Instead, <see cref="SupportTicket.RequestingTenantId"/> is a plain, explicitly-stamped
/// reference field (not a shadow property, no EF query filter), and every access rule is
/// hand-written in the query handlers (see Tickets/Queries) + <c>ISupportAccessGuard</c>. This
/// mirrors how Currency/ExchangeRate are excluded from tenant isolation as genuinely global
/// reference data (Module 6e) — here the same "exclude, then guard explicitly" shape is applied
/// to a genuinely cross-tenant *transactional* table instead.
/// </summary>
public sealed class SupportDbContext(DbContextOptions<SupportDbContext> options) : DbContext(options)
{
    public DbSet<SupportTicket>    Tickets           => Set<SupportTicket>();
    public DbSet<TicketMessage>    Messages          => Set<TicketMessage>();
    public DbSet<TicketAssignment> AssignmentHistory => Set<TicketAssignment>();
    public DbSet<TicketAttachment> Attachments       => Set<TicketAttachment>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("support");
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(SupportDbContext).Assembly);
        base.OnModelCreating(modelBuilder);
    }

    public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        foreach (var entry in ChangeTracker.Entries())
        {
            if (entry.State == EntityState.Added && entry.Properties.Any(p => p.Metadata.Name == "CreatedAt"))
                entry.Property("CreatedAt").CurrentValue = now;
        }
        return await base.SaveChangesAsync(cancellationToken);
    }
}
