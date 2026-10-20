using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Softaxis.Library.Infrastructure.Persistence;

/// <summary>
/// Design-time factory used only by `dotnet ef`. The service runs hosted inside the ApiGateway,
/// so EF tooling has no app host to resolve the context from. Not used in production.
/// </summary>
public sealed class LibraryDbContextFactory : IDesignTimeDbContextFactory<LibraryDbContext>
{
    public LibraryDbContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<LibraryDbContext>()
            .UseSqlServer(
                Environment.GetEnvironmentVariable("SOFTAXIS_DB")
                ?? "Server=SHAHBAZ-QFINITY;Database=SoftaxisErpDb;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=True;")
            .Options;

        return new LibraryDbContext(options);
    }
}
