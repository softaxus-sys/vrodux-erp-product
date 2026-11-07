using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Infrastructure.Persistence;
using Softaxis.Fitness.Domain.Entities;

namespace Softaxis.Fitness.Infrastructure.Persistence;

public sealed class FitnessDbContext(DbContextOptions<FitnessDbContext> options)
    : DbContext(options), ITenantAmbientContext
{
    public DbSet<FitnessBranch>     Branches      => Set<FitnessBranch>();
    public DbSet<MembershipPlan>    Plans         => Set<MembershipPlan>();
    public DbSet<FitnessSettings>   Settings      => Set<FitnessSettings>();
    public DbSet<PortalSettings>    PortalSettings => Set<PortalSettings>();
    public DbSet<TenantLookup>      TenantLookups => Set<TenantLookup>();
    public DbSet<FitnessAlertState> AlertStates   => Set<FitnessAlertState>();
    public DbSet<FitnessMember>     Members       => Set<FitnessMember>();
    public DbSet<Subscription>      Subscriptions => Set<Subscription>();
    public DbSet<FreezePeriod>      Freezes       => Set<FreezePeriod>();
    public DbSet<FitnessPayment>    Payments      => Set<FitnessPayment>();
    public DbSet<CheckIn>           CheckIns      => Set<CheckIn>();
    public DbSet<BodyMeasurement>   Measurements  => Set<BodyMeasurement>();
    public DbSet<FitnessProgram>    Programs      => Set<FitnessProgram>();
    public DbSet<Trainer>           Trainers      => Set<Trainer>();
    public DbSet<ClassType>         ClassTypes    => Set<ClassType>();
    public DbSet<ClassSession>      Sessions      => Set<ClassSession>();
    public DbSet<ClassBooking>      Bookings      => Set<ClassBooking>();
    public DbSet<PtPackage>         PtPackages    => Set<PtPackage>();
    public DbSet<PtSession>         PtSessions    => Set<PtSession>();
    public DbSet<Equipment>         Equipment     => Set<Equipment>();
    public DbSet<MaintenanceLog>    Maintenance   => Set<MaintenanceLog>();
    public DbSet<Locker>            Lockers       => Set<Locker>();
    public DbSet<FitnessLead>       Leads         => Set<FitnessLead>();
    public DbSet<FitnessCounter>    Counters      => Set<FitnessCounter>();

    // Long free text and embedded images need nvarchar(max); everything else gets a cap so it can be
    // indexed. Anything not named here defaults to 300.
    private static readonly HashSet<string> Max = ["PhotoData", "ItemsJson"];
    private static readonly HashSet<string> Medium =
        ["Notes", "Description", "Bio", "Address", "HealthNotes", "Reason", "Certifications", "Specialties",
         "Interest", "FitnessGoal", "Goal", "SessionLog", "VoidReason", "CancelReason", "StatusReason",
         "LostReason", "DenyReason"];

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("fitness");

        // Identity owns this table. Outside the Fitness.Domain namespace on purpose, so it gets no
        // tenant filter: it is how an anonymous portal request learns which tenant it is for.
        modelBuilder.Entity<TenantLookup>(b =>
        {
            b.ToTable("tenants", "identity", t => t.ExcludeFromMigrations());
            b.HasKey(x => x.Id);
            b.Property(x => x.Id).ValueGeneratedNever();
        });

        modelBuilder.Entity<FitnessMember>().Ignore(x => x.FullName);
        modelBuilder.Entity<Subscription>().Ignore(x => x.Total).Ignore(x => x.Balance);
        modelBuilder.Entity<PtPackage>().Ignore(x => x.Remaining).Ignore(x => x.Balance);
        modelBuilder.Entity<BodyMeasurement>().Ignore(x => x.Bmi);

        foreach (var entity in modelBuilder.Model.GetEntityTypes())
            foreach (var p in entity.GetProperties())
            {
                if (p.ClrType == typeof(decimal) || p.ClrType == typeof(decimal?)) { p.SetPrecision(18); p.SetScale(2); }
                if (p.ClrType != typeof(string) || Max.Contains(p.Name)) continue;
                p.SetMaxLength(Medium.Contains(p.Name) ? 2000 : 300);
            }

        // Shadow TenantId + query filter on every table. This replaces any entity-level soft-delete
        // filter, so handlers apply !IsDeleted themselves.
        TenantIsolation.ApplyTenantId(modelBuilder, this, "Softaxis.Fitness.Domain");

        TenantIsolation.TenantUniqueIndex<FitnessMember>(modelBuilder, [nameof(FitnessMember.MemberNumber)]);
        TenantIsolation.TenantUniqueIndex<FitnessPayment>(modelBuilder, [nameof(FitnessPayment.ReceiptNumber)], excludeSoftDeleted: false);
        TenantIsolation.TenantUniqueIndex<FitnessCounter>(modelBuilder, [nameof(FitnessCounter.Kind)], excludeSoftDeleted: false);
        TenantIsolation.TenantUniqueIndex<FitnessSettings>(modelBuilder, [], excludeSoftDeleted: false);
        TenantIsolation.TenantUniqueIndex<PortalSettings>(modelBuilder, [], excludeSoftDeleted: false);
        TenantIsolation.TenantUniqueIndex<FitnessAlertState>(modelBuilder, [], excludeSoftDeleted: false);
        TenantIsolation.TenantUniqueIndex<ClassBooking>(modelBuilder,
            [nameof(ClassBooking.SessionId), nameof(ClassBooking.MemberId)], excludeSoftDeleted: false);

        modelBuilder.Entity<Subscription>().HasIndex(x => new { x.MemberId, x.EndDate });
        modelBuilder.Entity<CheckIn>().HasIndex(x => new { x.BranchId, x.Date });
        modelBuilder.Entity<CheckIn>().HasIndex(x => x.MemberId);
        modelBuilder.Entity<FitnessPayment>().HasIndex(x => x.PaidOn);
        modelBuilder.Entity<ClassSession>().HasIndex(x => new { x.BranchId, x.Date });
        modelBuilder.Entity<PtSession>().HasIndex(x => new { x.TrainerId, x.Date });

        base.OnModelCreating(modelBuilder);
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        TenantIsolation.StampTenantId(ChangeTracker);
        return base.SaveChangesAsync(cancellationToken);
    }
}
