using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Softaxis.Inventory.Infrastructure.Persistence;

/// <summary>
/// Design-time factory used only by `dotnet ef` (migrations/scaffolding). The
/// service runs hosted inside the ApiGateway at runtime, so EF tooling has no
/// app host to resolve the context from â€” this provides one with a local
/// connection string. Not used in production.
/// </summary>
public sealed class InventoryDbContextFactory : IDesignTimeDbContextFactory<InventoryDbContext>
{
    public InventoryDbContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<InventoryDbContext>()
            .UseSqlServer(
                (System.Environment.GetEnvironmentVariable("SOFTAXIS_DB") ?? "Server=SHAHBAZ-LTP\\SQLEXPRESS;Database=SoftaxisErpDb;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=True;"))
            .Options;

        return new InventoryDbContext(options);
    }
}
