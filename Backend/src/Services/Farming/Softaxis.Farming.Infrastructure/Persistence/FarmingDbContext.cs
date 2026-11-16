using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Infrastructure.Persistence;
using Softaxis.Farming.Domain.Entities;

namespace Softaxis.Farming.Infrastructure.Persistence;

public sealed class FarmingDbContext(DbContextOptions<FarmingDbContext> options)
    : DbContext(options), ITenantAmbientContext
{
    public DbSet<FarmSettings>     Settings   => Set<FarmSettings>();
    public DbSet<Farm>             Farms      => Set<Farm>();
    public DbSet<FarmUnit>         Units      => Set<FarmUnit>();
    public DbSet<Animal>           Animals    => Set<Animal>();
    public DbSet<Batch>            Batches    => Set<Batch>();
    public DbSet<BreedingRecord>   Breeding   => Set<BreedingRecord>();
    public DbSet<WeightRecord>     Weights    => Set<WeightRecord>();
    public DbSet<ProductionRecord> Production => Set<ProductionRecord>();
    public DbSet<FeedRecord>       Feed       => Set<FeedRecord>();
    public DbSet<HealthRecord>     Health     => Set<HealthRecord>();
    public DbSet<MortalityRecord>  Mortality  => Set<MortalityRecord>();
    public DbSet<FarmSale>         Sales      => Set<FarmSale>();
    public DbSet<FarmExpense>      Expenses   => Set<FarmExpense>();

    private static readonly HashSet<string> Medium = ["Notes", "StatusReason", "Description"];

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("farming");

        modelBuilder.Entity<FarmSettings>().Ignore(x => x.Types);
        modelBuilder.Entity<FarmSale>().Ignore(x => x.Total).Ignore(x => x.Balance);

        foreach (var entity in modelBuilder.Model.GetEntityTypes())
        {
            // Ids are set in the constructors; EF must never think a new child row already exists.
            entity.FindProperty("Id")?.ValueGenerated = Microsoft.EntityFrameworkCore.Metadata.ValueGenerated.Never;
            foreach (var p in entity.GetProperties())
            {
                if (p.ClrType == typeof(decimal) || p.ClrType == typeof(decimal?)) { p.SetPrecision(18); p.SetScale(3); }
                if (p.ClrType != typeof(string)) continue;
                p.SetMaxLength(Medium.Contains(p.Name) ? 2000 : 300);
            }
        }

        // Shadow TenantId + query filter on every table. This replaces any entity-level soft-delete
        // filter, so handlers apply !IsDeleted themselves.
        TenantIsolation.ApplyTenantId(modelBuilder, this, "Softaxis.Farming.Domain");

        TenantIsolation.TenantUniqueIndex<FarmSettings>(modelBuilder, [], excludeSoftDeleted: false);
        TenantIsolation.TenantUniqueIndex<Animal>(modelBuilder, [nameof(Animal.TagNumber)]);
        TenantIsolation.TenantUniqueIndex<Batch>(modelBuilder, [nameof(Batch.Code)]);

        modelBuilder.Entity<ProductionRecord>().HasIndex(x => new { x.Date, x.Product });
        modelBuilder.Entity<ProductionRecord>().HasIndex(x => x.AnimalId);
        modelBuilder.Entity<ProductionRecord>().HasIndex(x => x.BatchId);
        modelBuilder.Entity<FeedRecord>().HasIndex(x => x.Date);
        modelBuilder.Entity<HealthRecord>().HasIndex(x => x.NextDueOn);
        modelBuilder.Entity<MortalityRecord>().HasIndex(x => x.BatchId);
        modelBuilder.Entity<FarmSale>().HasIndex(x => x.Date);
        modelBuilder.Entity<FarmExpense>().HasIndex(x => x.Date);
        modelBuilder.Entity<BreedingRecord>().HasIndex(x => x.AnimalId);

        base.OnModelCreating(modelBuilder);
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        TenantIsolation.StampTenantId(ChangeTracker);
        return base.SaveChangesAsync(cancellationToken);
    }
}
