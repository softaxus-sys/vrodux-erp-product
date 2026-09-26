using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Infrastructure.Persistence;
using Softaxis.Seo.Domain.Entities;

namespace Softaxis.Seo.Infrastructure.Persistence;

public sealed class SeoDbContext(DbContextOptions<SeoDbContext> options)
    : DbContext(options), ITenantAmbientContext
{
    public DbSet<SeoSite>              Sites              => Set<SeoSite>();
    public DbSet<SeoGoogleIntegration> GoogleIntegrations => Set<SeoGoogleIntegration>();
    public DbSet<SeoGoogleResource>    GoogleResources    => Set<SeoGoogleResource>();
    public DbSet<SeoAudit>             Audits             => Set<SeoAudit>();
    public DbSet<SeoIssue>             Issues             => Set<SeoIssue>();
    public DbSet<SeoFix>               Fixes              => Set<SeoFix>();
    public DbSet<SeoArticle>             Articles             => Set<SeoArticle>();
    public DbSet<SeoContentSettings>     ContentSettings       => Set<SeoContentSettings>();
    public DbSet<SeoWordPressConnection> WordPressConnections  => Set<SeoWordPressConnection>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("seo");
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(SeoDbContext).Assembly);
        TenantIsolation.ApplyTenantId(modelBuilder, this, "Softaxis.Seo.Domain");
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
