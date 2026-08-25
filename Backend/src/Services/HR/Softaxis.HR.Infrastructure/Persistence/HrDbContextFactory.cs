using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Softaxis.HR.Infrastructure.Persistence;

/// <summary>
/// Design-time factory for `dotnet ef` only — the service itself runs hosted in the gateway.
///
/// <para>Without this, EF falls back to building the API's host, which registers HR's MediatR
/// handlers but not the gateway-provided <c>ICurrentUser</c>, so service validation fails and no
/// migration can be created. Mirrors the factories the other services already have.</para>
/// </summary>
public sealed class HrDbContextFactory : IDesignTimeDbContextFactory<HrDbContext>
{
    public HrDbContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<HrDbContext>()
            .UseSqlServer(
                Environment.GetEnvironmentVariable("SOFTAXIS_DB")
                    ?? "Server=SHAHBAZ-QFINITY;Database=SoftaxisErpDb;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=True;",
                sql => sql.MigrationsAssembly(typeof(HrDbContext).Assembly.FullName))
            .Options;
        return new HrDbContext(options);
    }
}
