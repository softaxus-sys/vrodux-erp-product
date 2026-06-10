using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Softaxis.Hospitality.Infrastructure.Persistence;

/// <summary>Design-time factory for `dotnet ef` only (service runs hosted in the gateway).</summary>
public sealed class HospitalityDbContextFactory : IDesignTimeDbContextFactory<HospitalityDbContext>
{
    public HospitalityDbContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<HospitalityDbContext>()
            .UseSqlServer(
                (System.Environment.GetEnvironmentVariable("SOFTAXIS_DB") ?? "Server=SHAHBAZ-QFINITY;Database=SoftaxisErpDb;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=True;"),
                sql => sql.MigrationsHistoryTable("__EFMigrationsHistory", "dbo"))
            .Options;
        return new HospitalityDbContext(options);
    }
}

