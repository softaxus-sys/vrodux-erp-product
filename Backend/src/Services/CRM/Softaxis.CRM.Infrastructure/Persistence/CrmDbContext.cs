using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Infrastructure.Persistence;
using Softaxis.CRM.Domain.Entities;
using Softaxis.CRM.Domain.Entities.Integrations;

namespace Softaxis.CRM.Infrastructure.Persistence;

public sealed class CrmDbContext(DbContextOptions<CrmDbContext> options) : DbContext(options), ITenantAmbientContext
{
    public DbSet<Lead>        Leads      => Set<Lead>();
    public DbSet<LeadAssignment> LeadAssignments => Set<LeadAssignment>();
    public DbSet<CrmCustomer> Customers  => Set<CrmCustomer>();
    public DbSet<Deal>        Deals      => Set<Deal>();
    public DbSet<DealContact> DealContacts => Set<DealContact>();
    public DbSet<DealStageHistory> DealStageHistory => Set<DealStageHistory>();
    public DbSet<Activity>    Activities => Set<Activity>();
    public DbSet<CrmDocument> Documents  => Set<CrmDocument>();
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

    // ── Integration platform (lead sources) ───────────────────────────────────
    public DbSet<Integration>         Integrations             => Set<Integration>();
    public DbSet<FieldMapping>        IntegrationFieldMappings => Set<FieldMapping>();
    public DbSet<IntegrationResource> IntegrationResources     => Set<IntegrationResource>();
    public DbSet<IntegrationSyncLog>  IntegrationSyncLogs      => Set<IntegrationSyncLog>();
    public DbSet<RawLeadInbox>        RawLeadInbox             => Set<RawLeadInbox>();
    public DbSet<LeadSource>          LeadSources              => Set<LeadSource>();

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
        TenantIsolation.ApplyTenantId(modelBuilder, this, tenantOwned);

        // Covering index for the leads LIST query — its exact filter and its default sort.
        //
        // Declared here rather than in LeadConfiguration because TenantId is a shadow property:
        // it does not exist until ApplyTenantId has run, so an IEntityTypeConfiguration cannot
        // name it. (Same reason TenantIsolation.TenantUniqueIndex is called from the contexts.)
        //
        // Without it the query scans and then SORTS every matching lead to return 25. Measured on
        // ~6,000 leads: 605 physical reads and a sort worktable, versus 1 physical read and no
        // worktable with the index. The sort is the part that matters — it needs a memory grant,
        // and under startup load (three backfills each reading the whole table) that grant queues
        // and the query passes the 30 s command timeout. Idle it still returned in ~76 ms, which
        // is why the problem only ever showed up on a busy database.
        modelBuilder.Entity<Lead>()
            .HasIndex("TenantId", "IsDeleted", "LeadDate", "Id")
            .HasDatabaseName("IX_leads_TenantId_IsDeleted_LeadDate_Id")
            .IsDescending(false, false, true, false)
            .IncludeProperties(l => l.Status);

        // Read-only cross-schema views of Identity's teams, used by LeadAccessGuard for the
        // team-lead visibility tier. Mapped after ApplyTenantId and outside the CRM.Domain
        // namespace, so they get no shadow TenantId and no tenant query filter.
        modelBuilder.MapIdentityTeamViews();

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
