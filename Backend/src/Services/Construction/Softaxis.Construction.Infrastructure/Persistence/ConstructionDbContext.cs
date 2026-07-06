using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Infrastructure.Persistence;
using Softaxis.Construction.Domain.Entities;
using Softaxis.Construction.Infrastructure.Persistence.Configurations;

namespace Softaxis.Construction.Infrastructure.Persistence;

public sealed class ConstructionDbContext(DbContextOptions<ConstructionDbContext> options) : DbContext(options), ITenantAmbientContext
{
    public DbSet<Project>       Projects     => Set<Project>();
    public DbSet<ProjectPhase>  ProjectPhases => Set<ProjectPhase>();
    public DbSet<Site>          Sites        => Set<Site>();
    public DbSet<Contractor>    Contractors  => Set<Contractor>();
    public DbSet<BillOfQuantity> BOQs        => Set<BillOfQuantity>();
    public DbSet<BoqItem>       BoqItems     => Set<BoqItem>();
    public DbSet<Rfq>           Rfqs         => Set<Rfq>();
    public DbSet<Estimate>      Estimates    => Set<Estimate>();
    public DbSet<ConstructionContract> Contracts => Set<ConstructionContract>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("construction");
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(ConstructionDbContext).Assembly);
        BiddingLifecycleConfig.Apply(modelBuilder);
        TenantIsolation.ApplyTenantId(modelBuilder, this, "Softaxis.Construction.Domain");
        base.OnModelCreating(modelBuilder);
    }

    public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        TenantIsolation.StampTenantId(ChangeTracker);
        var now = DateTime.UtcNow;
        foreach (var entry in ChangeTracker.Entries())
        {
            if (entry.State == EntityState.Added && entry.Properties.Any(p => p.Metadata.Name == "CreatedAt"))
                entry.Property("CreatedAt").CurrentValue = now;
            if (entry.State == EntityState.Modified && entry.Properties.Any(p => p.Metadata.Name == "UpdatedAt"))
                entry.Property("UpdatedAt").CurrentValue = now;
        }
        return await base.SaveChangesAsync(cancellationToken);
    }
}
