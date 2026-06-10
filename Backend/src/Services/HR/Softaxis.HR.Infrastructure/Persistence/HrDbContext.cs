using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Infrastructure.Persistence;
using Softaxis.HR.Domain.Entities;

namespace Softaxis.HR.Infrastructure.Persistence;

public sealed class HrDbContext(DbContextOptions<HrDbContext> options)
    : DbContext(options)
{
    public DbSet<Department>   Departments   => Set<Department>();
    public DbSet<Employee>     Employees     => Set<Employee>();
    public DbSet<Leave>        Leaves        => Set<Leave>();
    public DbSet<AttendanceLog> AttendanceLogs => Set<AttendanceLog>();
    public DbSet<PayrollRun>   PayrollRuns   => Set<PayrollRun>();
    public DbSet<PayrollSlip>  PayrollSlips  => Set<PayrollSlip>();
    public DbSet<JobPosting>   JobPostings   => Set<JobPosting>();
    public DbSet<Applicant>    Applicants    => Set<Applicant>();
    public DbSet<PerformanceReview> PerformanceReviews => Set<PerformanceReview>();
    public DbSet<PerformanceGoal>   PerformanceGoals   => Set<PerformanceGoal>();

    /// <summary>Read-only view of identity.tenants — see <see cref="TenantLookup"/>.</summary>
    public DbSet<TenantLookup> TenantLookups => Set<TenantLookup>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("hr");
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(HrDbContext).Assembly);
        TenantIsolation.ApplyTenantId(modelBuilder, "Softaxis.HR.Domain");

        modelBuilder.Entity<TenantLookup>(b =>
        {
            b.ToTable("tenants", "identity", t => t.ExcludeFromMigrations());
            b.HasKey(x => x.Id);
            b.Property(x => x.Id).ValueGeneratedNever();
            b.Property(x => x.Slug).HasMaxLength(100);
            b.Property(x => x.Name).HasMaxLength(200);
            b.Property(x => x.Status).HasMaxLength(30);
        });

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
