using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Infrastructure.Persistence;
using Softaxis.ProjectManagement.Domain.Entities;

namespace Softaxis.ProjectManagement.Infrastructure.Persistence;

public sealed class ProjectManagementDbContext(DbContextOptions<ProjectManagementDbContext> options)
    : DbContext(options), ITenantAmbientContext
{
    public DbSet<Project>      Projects     => Set<Project>();
    public DbSet<BoardColumn>  BoardColumns => Set<BoardColumn>();
    public DbSet<Label>        Labels       => Set<Label>();
    public DbSet<Sprint>       Sprints      => Set<Sprint>();
    public DbSet<Issue>        Issues       => Set<Issue>();
    public DbSet<IssueLabel>   IssueLabels  => Set<IssueLabel>();
    public DbSet<IssueComment> IssueComments => Set<IssueComment>();
    public DbSet<ProjectMember> ProjectMembers => Set<ProjectMember>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("projectmanagement");
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(ProjectManagementDbContext).Assembly);
        TenantIsolation.ApplyTenantId(modelBuilder, this, "Softaxis.ProjectManagement.Domain");

        // Project keys are unique PER TENANT and only among live rows.
        TenantIsolation.TenantUniqueIndex<Project>(modelBuilder, [nameof(Project.Key)]);
        base.OnModelCreating(modelBuilder);
    }

    public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        TenantIsolation.StampTenantId(ChangeTracker);
        var now = DateTime.UtcNow;
        foreach (var entry in ChangeTracker.Entries())
        {
            if (entry.State == EntityState.Added)
            {
                if (entry.Properties.Any(p => p.Metadata.Name == "CreatedAt"))
                    entry.Property("CreatedAt").CurrentValue = now;
            }
            if (entry.State == EntityState.Modified)
            {
                if (entry.Properties.Any(p => p.Metadata.Name == "UpdatedAt"))
                    entry.Property("UpdatedAt").CurrentValue = now;
            }
        }
        return await base.SaveChangesAsync(cancellationToken);
    }
}
