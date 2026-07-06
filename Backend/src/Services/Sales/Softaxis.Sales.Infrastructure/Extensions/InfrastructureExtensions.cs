using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Softaxis.BuildingBlocks.Infrastructure.Seeding;
using Microsoft.Extensions.DependencyInjection;
using Softaxis.BuildingBlocks.Application.Behaviors;
using Softaxis.Sales.Application.DeliveryChallans.Commands;
using Softaxis.Sales.Infrastructure.Handlers.DeliveryChallans;
using Softaxis.Sales.Infrastructure.Persistence;
using Softaxis.Sales.Infrastructure.Persistence.Seed;

namespace Softaxis.Sales.Infrastructure.Extensions;

public static class InfrastructureExtensions
{
    public static IServiceCollection AddSalesInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddDbContext<SalesDbContext>(opts =>
            opts.UseSqlServer(
                configuration.GetConnectionString("SalesDb"),
                sql => sql.MigrationsAssembly(typeof(SalesDbContext).Assembly.FullName)));

        // ── MediatR — scan Application + Infrastructure for handlers ─────────
        services.AddMediatR(cfg =>
        {
            cfg.RegisterServicesFromAssemblies(
                typeof(CreateDeliveryChallanCommand).Assembly,   // Application
                typeof(CreateDeliveryChallanHandler).Assembly);  // Infrastructure

            cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(LoggingBehavior<,>));
            cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(ValidationBehavior<,>));
        });

        // ── FluentValidation — register all validators from Application ───────
        services.AddValidatorsFromAssembly(typeof(CreateDeliveryChallanCommand).Assembly);

        return services;
    }

    public static async Task MigrateAndSeedSalesAsync(this IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SalesDbContext>();
        await db.Database.MigrateAsync();
        if (DemoSeedGate.DemoEnabled(scope.ServiceProvider))
            await SalesSeedData.SeedAsync(db);
    }
}
