using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace Softaxis.Identity.Infrastructure.Persistence;

/// <summary>
/// Design-time factory so `dotnet ef migrations` can build the model without the API host.
/// The connection string + mediator are only used by the tooling (SaveChanges is never called),
/// so a no-op mediator is sufficient. Mirrors the other services' design-time factories.
/// </summary>
public sealed class IdentityDbContextFactory : IDesignTimeDbContextFactory<IdentityDbContext>
{
    public IdentityDbContext CreateDbContext(string[] args)
    {
        var options = new DbContextOptionsBuilder<IdentityDbContext>()
            .UseSqlServer(
                System.Environment.GetEnvironmentVariable("SOFTAXIS_DB")
                ?? "Server=SHAHBAZ-QFINITY;Database=SoftaxisErpDb;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=True;",
                sql => sql.MigrationsHistoryTable("__EFMigrationsHistory", "identity"))
            .Options;
        return new IdentityDbContext(options, new NoOpMediator());
    }

    /// <summary>No-op IMediator — design-time only; none of its members are invoked by EF tooling.</summary>
    private sealed class NoOpMediator : IMediator
    {
        public Task Publish(object notification, CancellationToken ct = default) => Task.CompletedTask;
        public Task Publish<TNotification>(TNotification notification, CancellationToken ct = default)
            where TNotification : INotification => Task.CompletedTask;
        public Task<TResponse> Send<TResponse>(IRequest<TResponse> request, CancellationToken ct = default)
            => Task.FromResult<TResponse>(default!);
        public Task<object?> Send(object request, CancellationToken ct = default)
            => Task.FromResult<object?>(null);
        public Task Send<TRequest>(TRequest request, CancellationToken ct = default) where TRequest : IRequest
            => Task.CompletedTask;
        public IAsyncEnumerable<TResponse> CreateStream<TResponse>(IStreamRequest<TResponse> request, CancellationToken ct = default)
            => throw new NotSupportedException();
        public IAsyncEnumerable<object?> CreateStream(object request, CancellationToken ct = default)
            => throw new NotSupportedException();
    }
}
