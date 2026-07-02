using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Softaxis.AiAssistant.Infrastructure.Persistence;

/// <summary>Design-time factory for `dotnet ef` only (service runs hosted in the gateway).</summary>
public sealed class AiAssistantDbContextFactory : IDesignTimeDbContextFactory<AiAssistantDbContext>
{
    public AiAssistantDbContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<AiAssistantDbContext>()
            .UseSqlServer(
                System.Environment.GetEnvironmentVariable("SOFTAXIS_DB")
                    ?? "Server=SHAHBAZ-QFINITY;Database=SoftaxisErpDb;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=True;",
                sql => sql.MigrationsHistoryTable("__EFMigrationsHistory", "dbo"))
            .Options;
        return new AiAssistantDbContext(options);
    }
}
