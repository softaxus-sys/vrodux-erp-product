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

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("library");
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(LibraryDbContext).Assembly);

        // Shadow TenantId + query filter on every table. This replaces any entity-level
        // soft-delete filter, so handlers apply !IsDeleted themselves.
        TenantIsolation.ApplyTenantId(modelBuilder, this, "Softaxis.Library.Domain");

        // A barcode identifies one copy and a card number one member — per tenant, among live rows.
        TenantIsolation.TenantUniqueIndex<BookCopy>(modelBuilder, [nameof(BookCopy.Barcode)]);
        TenantIsolation.TenantUniqueIndex<Member>(modelBuilder, [nameof(Member.MemberNumber)]);

        base.OnModelCreating(modelBuilder);
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        TenantIsolation.StampTenantId(ChangeTracker);
        return base.SaveChangesAsync(cancellationToken);
    }
}
