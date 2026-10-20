using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Infrastructure.Persistence;
using Softaxis.Library.Domain.Entities;

namespace Softaxis.Library.Infrastructure.Persistence;

public sealed class LibraryDbContext(DbContextOptions<LibraryDbContext> options)
    : DbContext(options), ITenantAmbientContext
{
    public DbSet<LibraryBranch>  Branches        => Set<LibraryBranch>();
    public DbSet<BookTitle>      Titles          => Set<BookTitle>();
    public DbSet<BookCopy>       Copies          => Set<BookCopy>();
    public DbSet<MembershipType> MembershipTypes => Set<MembershipType>();
    public DbSet<Member>         Members         => Set<Member>();
    public DbSet<Loan>           Loans           => Set<Loan>();
    public DbSet<Reservation>    Reservations    => Set<Reservation>();
    public DbSet<Fine>           Fines           => Set<Fine>();
    public DbSet<FinePayment>    FinePayments    => Set<FinePayment>();
    public DbSet<BranchStaff>    BranchStaff     => Set<BranchStaff>();
    public DbSet<ReminderSettings> ReminderSettings => Set<ReminderSettings>();
    public DbSet<ReminderLog>      ReminderLogs     => Set<ReminderLog>();
    public DbSet<PortalSettings>   PortalSettings   => Set<PortalSettings>();
    /// <summary>Read-only view of identity.tenants: the member portal finds its workspace by slug.</summary>
    public DbSet<TenantLookup>     TenantLookups    => Set<TenantLookup>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("library");
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(LibraryDbContext).Assembly);

        // Identity owns this table. Outside the Library namespace on purpose, so it gets no
        // tenant filter — it is how an anonymous portal request learns which tenant it is for.
        modelBuilder.Entity<TenantLookup>(b =>
        {
            b.ToTable("tenants", "identity", t => t.ExcludeFromMigrations());
            b.HasKey(x => x.Id);
            b.Property(x => x.Id).ValueGeneratedNever();
        });

        // Shadow TenantId + query filter on every table. This replaces any entity-level
        // soft-delete filter, so handlers apply !IsDeleted themselves.
        TenantIsolation.ApplyTenantId(modelBuilder, this, "Softaxis.Library.Domain");

        // A barcode identifies one copy and a card number one member — per tenant, among live rows.
        TenantIsolation.TenantUniqueIndex<BookCopy>(modelBuilder, [nameof(BookCopy.Barcode)]);
        TenantIsolation.TenantUniqueIndex<Member>(modelBuilder, [nameof(Member.MemberNumber)]);
        // One settings row per workspace, and one log row per notice — the second is what makes
        // "claim, then send" safe against two passes running at once.
        TenantIsolation.TenantUniqueIndex<BranchStaff>(modelBuilder, [nameof(Domain.Entities.BranchStaff.BranchId), nameof(Domain.Entities.BranchStaff.UserId)], excludeSoftDeleted: false);
        TenantIsolation.TenantUniqueIndex<ReminderSettings>(modelBuilder, [], excludeSoftDeleted: false);
        TenantIsolation.TenantUniqueIndex<PortalSettings>(modelBuilder, [], excludeSoftDeleted: false);
        TenantIsolation.TenantUniqueIndex<ReminderLog>(modelBuilder, [nameof(ReminderLog.Key)], excludeSoftDeleted: false);

        base.OnModelCreating(modelBuilder);
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        TenantIsolation.StampTenantId(ChangeTracker);
        return base.SaveChangesAsync(cancellationToken);
    }
}
