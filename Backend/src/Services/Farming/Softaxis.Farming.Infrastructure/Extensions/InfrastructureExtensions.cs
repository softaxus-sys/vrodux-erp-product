using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Softaxis.BuildingBlocks.Application.Behaviors;
using Softaxis.BuildingBlocks.Infrastructure.Persistence;
using Softaxis.Farming.Application;
using Softaxis.Farming.Infrastructure.Persistence;

namespace Softaxis.Farming.Infrastructure.Extensions;

public static class InfrastructureExtensions
{
    public static IServiceCollection AddFarmingInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        // Every service shares one database; falling back to IdentityDb means a deployment with no
        // FarmingDb key still starts.
        var connection = configuration.GetConnectionString("FarmingDb") ?? configuration.GetConnectionString("IdentityDb");

        services.AddDbContext<FarmingDbContext>(opts =>
            opts.UseSqlServer(connection, sql => sql.MigrationsAssembly(typeof(FarmingDbContext).Assembly.FullName)));

        services.AddMediatR(cfg =>
        {
            cfg.RegisterServicesFromAssemblies(typeof(AssemblyMarker).Assembly, typeof(FarmingDbContext).Assembly);
            cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(LoggingBehavior<,>));
            cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(ValidationBehavior<,>));
        });
        services.AddValidatorsFromAssembly(typeof(AssemblyMarker).Assembly);
        return services;
    }

    public static async Task MigrateAndSeedFarmingAsync(this IServiceProvider services)
    {
        // Migrate only. Settings and the first farm are created per workspace on first use: a startup
        // seed has no tenant, so its rows would be invisible to every workspace.
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<FarmingDbContext>();
        await db.Database.MigrateTolerantOfLockReleaseAsync();
    }
}
