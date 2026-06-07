using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Infrastructure.Persistence;
using Softaxis.CRM.Domain.Entities;

namespace Softaxis.CRM.Infrastructure.Persistence;

public sealed class CrmDbContext(DbContextOptions<CrmDbContext> options) : DbContext(options)
{
    public DbSet<Lead>        Leads      => Set<Lead>();
    public DbSet<CrmCustomer> Customers  => Set<CrmCustomer>();
    public DbSet<Deal>        Deals      => Set<Deal>();
    public DbSet<Activity>    Activities => Set<Activity>();
    public DbSet<Contact>       Contacts       => Set<Contact>();
    public DbSet<Patient>       Patients       => Set<Patient>();
    public DbSet<Appointment>   Appointments   => Set<Appointment>();
    public DbSet<TreatmentPlan> TreatmentPlans => Set<TreatmentPlan>();
    public DbSet<Admission>     Admissions     => Set<Admission>();
    public DbSet<Student>       Students       => Set<Student>();
    public DbSet<Enrollment>    Enrollments    => Set<Enrollment>();
    public DbSet<Policy>          Policies        => Set<Policy>();
    public DbSet<PolicyRenewal>   PolicyRenewals  => Set<PolicyRenewal>();
    public DbSet<InsuranceClaim>  InsuranceClaims => Set<InsuranceClaim>();
    public DbSet<Proposal>        Proposals        => Set<Proposal>();
    public DbSet<ServiceContract> ServiceContracts => Set<ServiceContract>();
    public DbSet<SupportTicket>   SupportTickets   => Set<SupportTicket>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("crm");
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(CrmDbContext).Assembly);
        Configurations.HealthcareConfig.Apply(modelBuilder);
        Configurations.EducationConfig.Apply(modelBuilder);
        Configurations.InsuranceConfig.Apply(modelBuilder);
        Configurations.B2BConfig.Apply(modelBuilder);

        // Row-level tenant isolation for every CRM-domain table (shadow TenantId
        // column + global query filter scoped to the current tenant).
        var tenantOwned = modelBuilder.Model.GetEntityTypes()
            .Where(t => !t.IsOwned()
                     && t.ClrType.Namespace?.StartsWith("Softaxis.CRM.Domain") == true)
            .Select(t => t.ClrType)
            .Distinct()
            .ToList();
        TenantIsolation.ApplyTenantId(modelBuilder, tenantOwned);

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
