using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Softaxis.BuildingBlocks.Infrastructure.Notifications;

/// <summary>
/// Design-time factory for <c>dotnet ef</c> only — this context is hosted by the gateway at runtime.
/// Without it EF has no host to build (BuildingBlocks has no Program), so no migration can be created.
/// Mirrors the per-service factories.
/// </summary>
public sealed class NotificationsDbContextFactory : IDesignTimeDbContextFactory<NotificationsDbContext>
{
    public NotificationsDbContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<NotificationsDbContext>()
            .UseSqlServer(
                Environment.GetEnvironmentVariable("SOFTAXIS_DB")
                    ?? "Server=SHAHBAZ-QFINITY;Database=SoftaxisErpDb;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=True;",
                sql => sql.MigrationsAssembly(typeof(NotificationsDbContext).Assembly.FullName))
            .Options;
        return new NotificationsDbContext(options);
    }
}
