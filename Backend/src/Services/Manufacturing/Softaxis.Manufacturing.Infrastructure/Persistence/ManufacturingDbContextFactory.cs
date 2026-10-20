using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Softaxis.Manufacturing.Infrastructure.Persistence;

/// <summary>
/// Design-time factory used only by `dotnet ef`. The service runs hosted inside the ApiGateway,
/// so EF tooling has no app host to resolve the context from. Not used in production.
/// </summary>
public sealed class ManufacturingDbContextFactory : IDesignTimeDbContextFactory<ManufacturingDbContext>
{
    public ManufacturingDbContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<ManufacturingDbContext>()
            .UseSqlServer(
                Environment.GetEnvironmentVariable("SOFTAXIS_DB")
                ?? "Server=SHAHBAZ-QFINITY;Database=SoftaxisErpDb;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=True;")
            .Options;

        return new ManufacturingDbContext(options);
    }
}
