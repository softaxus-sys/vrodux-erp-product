using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.BuildingBlocks.Domain.Notifications;
using Softaxis.BuildingBlocks.Infrastructure.Persistence;

namespace Softaxis.BuildingBlocks.Infrastructure.Notifications;

/// <summary>
/// The platform's one notification store (schema <c>notifications</c>). It lives in BuildingBlocks
/// rather than in a service of its own because every module needs to WRITE to it: a standalone
/// service would still have needed a shared abstraction for that, plus cross-service calls on a path
/// that must never fail the work that triggered it.
///
/// <para>Plain <see cref="DbContext"/>, not BaseDbContext: there are no domain events or soft deletes
/// here, and BaseDbContext's constructor wants an IMediator this context has no use for.
/// <see cref="TenantIsolation.StampTenantId"/> is called directly in SaveChanges instead.</para>
/// </summary>
public sealed class NotificationsDbContext(DbContextOptions<NotificationsDbContext> options)
    : DbContext(options), ITenantAmbientContext
{
    public DbSet<Notification> Notifications => Set<Notification>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("notifications");
        modelBuilder.ApplyConfiguration(new NotificationConfiguration());

        // Explicit type list, not the namespace overload: this context maps exactly one entity and
        // BuildingBlocks.Domain also holds non-entity primitives that must never be swept in.
        TenantIsolation.ApplyTenantId(modelBuilder, this, new[] { typeof(Notification) });

        base.OnModelCreating(modelBuilder);
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        TenantIsolation.StampTenantId(ChangeTracker);
        return base.SaveChangesAsync(cancellationToken);
    }
}

internal sealed class NotificationConfiguration : IEntityTypeConfiguration<Notification>
{
    public void Configure(EntityTypeBuilder<Notification> b)
    {
        b.ToTable("notifications");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).ValueGeneratedNever();
        b.Property(x => x.Module).IsRequired().HasMaxLength(40);
        b.Property(x => x.Event).IsRequired().HasMaxLength(60);
        b.Property(x => x.Type).IsRequired().HasMaxLength(30);
        b.Property(x => x.Title).IsRequired().HasMaxLength(200);
        b.Property(x => x.Message).IsRequired().HasMaxLength(1000);
        b.Property(x => x.Link).HasMaxLength(500);
        b.Property(x => x.RelatedToType).HasMaxLength(40);

        // "my newest alerts" — the bell's only read path, on every poll and every panel open.
        b.HasIndex(x => new { x.UserId, x.CreatedAt });
        // The unread badge is read far more often than the list itself; filtered so the index stays
        // small no matter how much read history accumulates.
        b.HasIndex(x => new { x.UserId, x.ReadAt }).HasFilter("[ReadAt] IS NULL");
    }
}
