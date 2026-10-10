using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Softaxis.BuildingBlocks.Application.Behaviors;
using Softaxis.BuildingBlocks.Infrastructure.Persistence;
using Softaxis.Manufacturing.Application;
using Softaxis.Manufacturing.Application.Abstractions;
using Softaxis.Manufacturing.Infrastructure.Persistence;
using Softaxis.Manufacturing.Infrastructure.Services;

namespace Softaxis.Manufacturing.Infrastructure.Extensions;

public static class InfrastructureExtensions
{
    public static IServiceCollection AddManufacturingInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        // Every service shares one database; falling back to IdentityDb means a deployment that
        // has not been given a ManufacturingDb key still starts.
        var connection = configuration.GetConnectionString("ManufacturingDb")
                         ?? configuration.GetConnectionString("IdentityDb");

        services.AddDbContext<ManufacturingDbContext>(opts =>
            opts.UseSqlServer(connection,
                sql => sql.MigrationsAssembly(typeof(ManufacturingDbContext).Assembly.FullName)));

        services.AddMediatR(cfg =>
        {
            cfg.RegisterServicesFromAssemblies(
                typeof(AssemblyMarker).Assembly,              // Application
                typeof(ManufacturingDbContext).Assembly);     // Infrastructure (handlers)

            cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(LoggingBehavior<,>));
            cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(ValidationBehavior<,>));
        });

        services.AddValidatorsFromAssembly(typeof(AssemblyMarker).Assembly);

        // Requires AddInventoryInfrastructure: the stock ledger is Inventory's.
        services.AddScoped<IManufacturingStock, InventoryStockGateway>();

        // Daily "needs attention" digest (overdue orders, short components).
        services.AddHostedService<ProductionAlertService>();

        return services;
    }

    public static async Task MigrateAndSeedManufacturingAsync(this IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ManufacturingDbContext>();
        await db.Database.MigrateTolerantOfLockReleaseAsync();
    }
}
