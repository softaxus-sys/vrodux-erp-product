using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Softaxis.Seo.Infrastructure.Persistence;

/// <summary>Design-time factory for `dotnet ef` only (service runs hosted in the gateway).</summary>
public sealed class SeoDbContextFactory : IDesignTimeDbContextFactory<SeoDbContext>
{
    public SeoDbContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<SeoDbContext>()
            .UseSqlServer(
                System.Environment.GetEnvironmentVariable("SOFTAXIS_DB")
                    ?? "Server=SHAHBAZ-LTP\\SQLEXPRESS;Database=SoftaxisErpDb;Integrated Security=true;MultipleActiveResultSets=true;TrustServerCertificate=True;",
                sql => sql.MigrationsHistoryTable("__EFMigrationsHistory", "dbo"))
            .Options;
        return new SeoDbContext(options);
    }
}
