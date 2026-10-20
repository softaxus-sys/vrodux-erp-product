using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Softaxis.BuildingBlocks.Application.Behaviors;
using Softaxis.BuildingBlocks.Infrastructure.Persistence;
using Softaxis.Trade.Application;
using Softaxis.Trade.Infrastructure.Persistence;
using Softaxis.Trade.Infrastructure.Services;

namespace Softaxis.Trade.Infrastructure.Extensions;

public static class InfrastructureExtensions
{
    public static IServiceCollection AddTradeInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        // Every service shares one database; falling back to IdentityDb means a deployment that
        // has not been given a TradeDb key still starts.
        var connection = configuration.GetConnectionString("TradeDb")
                         ?? configuration.GetConnectionString("IdentityDb");

        services.AddDbContext<TradeDbContext>(opts =>
            opts.UseSqlServer(connection,
                sql => sql.MigrationsAssembly(typeof(TradeDbContext).Assembly.FullName)));

        services.AddMediatR(cfg =>
        {
            cfg.RegisterServicesFromAssemblies(
                typeof(AssemblyMarker).Assembly,       // Application
                typeof(TradeDbContext).Assembly);      // Infrastructure (handlers)

            cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(LoggingBehavior<,>));
            cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(ValidationBehavior<,>));
        });

        services.AddValidatorsFromAssembly(typeof(AssemblyMarker).Assembly);

        // Daily "what needs attention" digest into the notification bell.
        services.AddHostedService<TradeAlertService>();

        return services;
    }

    public static async Task MigrateAndSeedTradeAsync(this IServiceProvider services)
    {
        // Migrate only. Nothing is seeded: a startup seed has no tenant, so its rows would be
        // invisible to every workspace.
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<TradeDbContext>();
        await db.Database.MigrateTolerantOfLockReleaseAsync();
    }
}
