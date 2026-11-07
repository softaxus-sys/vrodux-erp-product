using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Softaxis.BuildingBlocks.Application.Behaviors;
using Softaxis.BuildingBlocks.Infrastructure.Persistence;
using Softaxis.Fitness.Application;
using Softaxis.Fitness.Infrastructure.Persistence;

namespace Softaxis.Fitness.Infrastructure.Extensions;

public static class InfrastructureExtensions
{
    public static IServiceCollection AddFitnessInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        // Every service shares one database; falling back to IdentityDb means a deployment with no
        // FitnessDb key still starts.
        var connection = configuration.GetConnectionString("FitnessDb") ?? configuration.GetConnectionString("IdentityDb");

        services.AddDbContext<FitnessDbContext>(opts =>
            opts.UseSqlServer(connection, sql => sql.MigrationsAssembly(typeof(FitnessDbContext).Assembly.FullName)));

        services.AddHostedService<Services.FitnessAlertService>();
        services.AddSingleton<Services.IPortalSecurity, Services.PortalSecurity>();
        services.AddMediatR(cfg =>
        {
            cfg.RegisterServicesFromAssemblies(typeof(AssemblyMarker).Assembly, typeof(FitnessDbContext).Assembly);
            cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(LoggingBehavior<,>));
            cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(ValidationBehavior<,>));
        });
        services.AddValidatorsFromAssembly(typeof(AssemblyMarker).Assembly);
        return services;
    }

    public static async Task MigrateAndSeedFitnessAsync(this IServiceProvider services)
    {
        // Migrate only. Branch and settings are created per workspace on first use: a startup seed
        // has no tenant, so its rows would be invisible to every workspace.
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<FitnessDbContext>();
        await db.Database.MigrateTolerantOfLockReleaseAsync();
    }
}
