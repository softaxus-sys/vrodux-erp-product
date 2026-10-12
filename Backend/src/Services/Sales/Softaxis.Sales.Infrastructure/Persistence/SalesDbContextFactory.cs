using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Softaxis.Sales.Infrastructure.Persistence;

/// <summary>
/// Design-time factory for `dotnet ef` only — the service itself runs hosted in the gateway.
///
/// <para>Without this, EF falls back to building the API's standalone host, which registers Sales'
/// MediatR handlers but not the gateway-provided services some of them need (the notification
/// dispatcher), so service validation fails and no migration can be created. Mirrors
/// <c>HrDbContextFactory</c>.</para>
/// </summary>
public sealed class SalesDbContextFactory : IDesignTimeDbContextFactory<SalesDbContext>
{
    public SalesDbContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<SalesDbContext>()
            .UseSqlServer(
                Environment.GetEnvironmentVariable("SOFTAXIS_DB")
                    ?? "Server=SHAHBAZ-QFINITY;Database=SoftaxisErpDb;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=True;",
                sql => sql.MigrationsAssembly(typeof(SalesDbContext).Assembly.FullName))
            .Options;
        return new SalesDbContext(options);
    }
}
