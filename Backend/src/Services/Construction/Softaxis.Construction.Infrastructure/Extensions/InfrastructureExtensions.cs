using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Softaxis.BuildingBlocks.Application.Behaviors;
using Softaxis.Construction.Application;
using Softaxis.Construction.Infrastructure.Persistence;
using Softaxis.Construction.Infrastructure.Persistence.Seed;

namespace Softaxis.Construction.Infrastructure.Extensions;

public static class InfrastructureExtensions
{
    public static IServiceCollection AddConstructionInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddDbContext<ConstructionDbContext>(opts =>
            opts.UseSqlServer(configuration.GetConnectionString("ConstructionDb"),
                sql => sql.MigrationsAssembly(typeof(ConstructionDbContext).Assembly.FullName)));

        // ── MediatR — scan Application + Infrastructure for handlers ─────────
        services.AddMediatR(cfg =>
        {
            cfg.RegisterServicesFromAssemblies(
                typeof(AssemblyReference).Assembly,         // Application
                typeof(InfrastructureExtensions).Assembly); // Infrastructure

            // Pipeline order matters: Logging wraps Validation wraps Handler
            cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(LoggingBehavior<,>));
            cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(ValidationBehavior<,>));
        });

        // ── FluentValidation — register all validators from Application ───────
        services.AddValidatorsFromAssembly(typeof(AssemblyReference).Assembly);

        return services;
    }

    public static async Task MigrateAndSeedConstructionAsync(this IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ConstructionDbContext>();
        await db.Database.MigrateAsync();
        await ConstructionSeedData.SeedAsync(db);
    }
}
