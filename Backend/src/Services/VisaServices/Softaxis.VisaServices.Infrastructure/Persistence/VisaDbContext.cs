using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Infrastructure.Persistence;
using Softaxis.VisaServices.Domain.Entities;

namespace Softaxis.VisaServices.Infrastructure.Persistence;

public sealed class VisaDbContext(DbContextOptions<VisaDbContext> options)
    : DbContext(options), ITenantAmbientContext
{
    public DbSet<VisaCase>        VisaCases        => Set<VisaCase>();
    public DbSet<Applicant>       Applicants       => Set<Applicant>();
    public DbSet<VisaType>        VisaTypes        => Set<VisaType>();
    public DbSet<CaseDocument>    CaseDocuments    => Set<CaseDocument>();
    public DbSet<CaseStatusEvent> CaseStatusEvents => Set<CaseStatusEvent>();
    public DbSet<ChannelAccount>  ChannelAccounts  => Set<ChannelAccount>();
    public DbSet<GovtSubmission>  GovtSubmissions  => Set<GovtSubmission>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("visa");
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(VisaDbContext).Assembly);
        // Every visa-domain table (incl. VisaType — the catalogue is now tenant-owned and
        // editable per consultancy) gets the shadow TenantId column + query filter.
        TenantIsolation.ApplyTenantId(modelBuilder, this, "Softaxis.VisaServices.Domain");
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
