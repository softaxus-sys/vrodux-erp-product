using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Infrastructure.Persistence;
using Softaxis.HR.Domain.Entities;

namespace Softaxis.HR.Infrastructure.Persistence;

public sealed class HrDbContext(DbContextOptions<HrDbContext> options)
    : DbContext(options), ITenantAmbientContext
{
    public DbSet<Department>   Departments   => Set<Department>();
    public DbSet<Employee>     Employees     => Set<Employee>();
    public DbSet<Leave>        Leaves        => Set<Leave>();
    public DbSet<AttendanceLog> AttendanceLogs => Set<AttendanceLog>();
    public DbSet<LeavePolicy>  LeavePolicies => Set<LeavePolicy>();
    public DbSet<WorkSchedule> WorkSchedules => Set<WorkSchedule>();
    public DbSet<WpsConfiguration> WpsConfigurations => Set<WpsConfiguration>();
    public DbSet<EmployeeDocument> EmployeeDocuments => Set<EmployeeDocument>();

    /// <summary>Read-only view of [identity].[users] — never written to, never migrated.</summary>
    internal DbSet<IdentityUserView> IdentityUsers => Set<IdentityUserView>();
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
        TenantIsolation.ApplyTenantId(modelBuilder, this, "Softaxis.HR.Domain");

        // Read-only window onto Identity so an employee can show its linked login account.
        modelBuilder.MapIdentityUserView();

        // Business keys are unique PER TENANT and only among live rows. A global unique index
        // would let one tenant's value block another tenant, and would make a soft-deleted row's
        // value unusable forever. Declared here because TenantId is a shadow property that only
        // exists after ApplyTenantId has run.
        TenantIsolation.TenantUniqueIndex<Employee>(modelBuilder, [nameof(Employee.Email)]);
        TenantIsolation.TenantUniqueIndex<Employee>(modelBuilder, [nameof(Employee.EmployeeNumber)]);
        TenantIsolation.TenantUniqueIndex<Department>(modelBuilder, [nameof(Department.Name)]);
        TenantIsolation.TenantUniqueIndex<Department>(modelBuilder, [nameof(Department.Code)], extraFilter: "[Code] IS NOT NULL");
        TenantIsolation.TenantUniqueIndex<Leave>(modelBuilder, [nameof(Leave.LeaveNumber)]);
        TenantIsolation.TenantUniqueIndex<PayrollRun>(modelBuilder, [nameof(PayrollRun.RunNumber)]);
        // One employee per login. Filtered so the many employees with no login do not collide.
        TenantIsolation.TenantUniqueIndex<Employee>(modelBuilder, [nameof(Employee.UserId)],
            extraFilter: "[UserId] IS NOT NULL");

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
