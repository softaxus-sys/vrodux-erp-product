using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Softaxis.Finance.Infrastructure.Persistence;

/// <summary>
/// Design-time factory for `dotnet ef` only. The service runs hosted in the
/// ApiGateway at runtime; EF tooling needs its own way to build the context.
/// Uses the shared migrations history table (dbo.__EFMigrationsHistory).
/// </summary>
public sealed class FinanceDbContextFactory : IDesignTimeDbContextFactory<FinanceDbContext>
{
    public FinanceDbContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<FinanceDbContext>()
            .UseSqlServer(
                (System.Environment.GetEnvironmentVariable("SOFTAXIS_DB") ?? "Server=SHAHBAZ-QFINITY;Database=SoftaxisErpDb;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=True;"))
            .Options;
        return new FinanceDbContext(options);
    }
}
