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

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("hr");
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(HrDbContext).Assembly);
        TenantIsolation.ApplyTenantId(modelBuilder, "Softaxis.HR.Domain");
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
