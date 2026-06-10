using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Softaxis.CRM.Infrastructure.Persistence;

/// <summary>Design-time factory for `dotnet ef` only (service runs hosted in the gateway).</summary>
public sealed class CrmDbContextFactory : IDesignTimeDbContextFactory<CrmDbContext>
{
    public CrmDbContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<CrmDbContext>()
            .UseSqlServer(
                (System.Environment.GetEnvironmentVariable("SOFTAXIS_DB") ?? "Server=SHAHBAZ-QFINITY;Database=SoftaxisErpDb;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=True;"),
                sql => sql.MigrationsHistoryTable("__EFMigrationsHistory", "dbo"))   // match runtime (shared dbo history)
            .Options;
        return new CrmDbContext(options);
    }
}

