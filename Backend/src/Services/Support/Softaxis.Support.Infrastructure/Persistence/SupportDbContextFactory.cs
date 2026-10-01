using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Softaxis.Support.Infrastructure.Persistence;

/// <summary>
/// Design-time factory for `dotnet ef` only — the service itself runs hosted in the gateway.
///
/// <para>Without this, EF falls back to building the API's host, which registers Support's
/// MediatR handlers but not the gateway-provided <c>IObjectStorage</c>/<c>IImageProcessor</c>
/// (registered once in the gateway's Program.cs, per the shared-object-storage pattern), so
/// service validation fails and no migration can be created. Mirrors the factories the other
/// services already have (HrDbContextFactory, CrmDbContextFactory, ...).</para>
/// </summary>
public sealed class SupportDbContextFactory : IDesignTimeDbContextFactory<SupportDbContext>
{
    public SupportDbContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<SupportDbContext>()
            .UseSqlServer(
                Environment.GetEnvironmentVariable("SOFTAXIS_DB")
                    ?? "Server=SHAHBAZ-QFINITY;Database=SoftaxisErpDb;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=True;",
                sql => sql.MigrationsAssembly(typeof(SupportDbContext).Assembly.FullName))
            .Options;
        return new SupportDbContext(options);
    }
}
