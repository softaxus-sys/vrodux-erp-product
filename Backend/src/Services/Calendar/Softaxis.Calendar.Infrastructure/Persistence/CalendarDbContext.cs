using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Softaxis.BuildingBlocks.Infrastructure.Persistence;
using Softaxis.Calendar.Domain.Entities;

namespace Softaxis.Calendar.Infrastructure.Persistence;

public sealed class CalendarDbContext(DbContextOptions<CalendarDbContext> options)
    : DbContext(options), ITenantAmbientContext
{
    public DbSet<CalendarEvent>      Events      => Set<CalendarEvent>();
    public DbSet<CalendarAttendee>   Attendees   => Set<CalendarAttendee>();
    public DbSet<CalendarConnection> Connections => Set<CalendarConnection>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("calendar");
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(CalendarDbContext).Assembly);
        TenantIsolation.ApplyTenantId(modelBuilder, this, "Softaxis.Calendar.Domain");
        base.OnModelCreating(modelBuilder);
    }

    public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        TenantIsolation.StampTenantId(ChangeTracker);
        return await base.SaveChangesAsync(cancellationToken);
    }
}

/// <summary>Design-time factory for `dotnet ef` only (the service runs hosted in the gateway).</summary>
public sealed class CalendarDbContextFactory : IDesignTimeDbContextFactory<CalendarDbContext>
{
    public CalendarDbContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<CalendarDbContext>()
            .UseSqlServer(
                System.Environment.GetEnvironmentVariable("SOFTAXIS_DB")
                    ?? "Server=SHAHBAZ-QFINITY;Database=SoftaxisErpDb;Integrated Security=true;MultipleActiveResultSets=true;TrustServerCertificate=True;",
                sql => sql.MigrationsHistoryTable("__EFMigrationsHistory", "dbo"))
            .Options;
        return new CalendarDbContext(options);
    }
}
