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

        // Index for the leads LIST query. It leads with the SORT column, not with TenantId, and
        // that ordering is the whole point.
        //
        // The list orders by LeadDate DESC and takes 25. Without an index in that order SQL Server
        // must read every matching lead and SORT them, which needs a memory grant — measured on
        // this data at 17 MB granted and 6,873 pages spilled to tempdb, 15.6 s at worst. That spill
        // is what produced the 30-second command timeouts.
        //
        // The obvious index — (TenantId, IsDeleted, LeadDate, Id) — cannot fix it, because the
        // tenant predicate is never sargable: the global filter is "bypass OR (ambient != null AND
        // TenantId == ambient)" and EF emits both sides as PARAMETERS, so the optimiser cannot seek
        // on TenantId and falls back to a scan plus the same sort. Leading with LeadDate sidesteps
        // that entirely: the index is already in the required order, so the engine walks it, applies
        // the tenant/status predicates as residuals, and stops after 25 rows. No sort, no grant, no
        // spill — regardless of what the OR does.
        //
        // Measured, 20 iterations each: full-access 15,633 ms worst case -> 0.3 ms. A team-tier
        // caller (whose extra owner/team predicate is selective enough to prefer a different plan)
        // goes 3.9 ms -> 14 ms. Losing 10 ms on the healthy path to save 15 seconds on the broken
        // one is the trade being made here, deliberately.
        //
        // Declared here rather than in LeadConfiguration because TenantId is a shadow property: it
        // does not exist until ApplyTenantId has run, so an IEntityTypeConfiguration cannot name it.
        modelBuilder.Entity<Lead>()
            .HasIndex(l => new { l.LeadDate, l.Id })
            .HasDatabaseName("IX_leads_LeadDate_Id")
            .IsDescending(true, false)
            // TenantId included by name — it is the shadow column, so a lambda cannot reach it, and
            // leaving it out would cost a key lookup per row just to evaluate the tenant filter.
            .IncludeProperties("TenantId", "IsDeleted", "Status", "AssignedToUserId", "TeamId");

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
