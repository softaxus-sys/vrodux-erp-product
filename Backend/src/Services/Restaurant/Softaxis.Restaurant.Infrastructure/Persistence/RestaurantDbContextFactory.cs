using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Softaxis.Restaurant.Infrastructure.Persistence;

/// <summary>
/// Design-time factory so `dotnet ef migrations` can build the model without the
/// API host. The connection string is only used at design time.
/// </summary>
public sealed class RestaurantDbContextFactory : IDesignTimeDbContextFactory<RestaurantDbContext>
{
    public RestaurantDbContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<RestaurantDbContext>()
            .UseSqlServer((System.Environment.GetEnvironmentVariable("SOFTAXIS_DB") ?? "Server=SHAHBAZ-LTP\\SQLEXPRESS;Database=SoftaxisErpDb;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=True;"))
            .Options;
        return new RestaurantDbContext(options);
    }
}
