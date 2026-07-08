using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Softaxis.BuildingBlocks.Application.Behaviors;
using Softaxis.VisaServices.Application;
using Softaxis.VisaServices.Domain.Entities;
using Softaxis.VisaServices.Infrastructure.Persistence;

namespace Softaxis.VisaServices.Infrastructure.Extensions;

public static class InfrastructureExtensions
{
    public static IServiceCollection AddVisaServicesInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddDbContext<VisaDbContext>(opts =>
            opts.UseSqlServer(
                configuration.GetConnectionString("VisaDb"),
                sql => sql.MigrationsAssembly(typeof(VisaDbContext).Assembly.FullName)));

        services.AddMediatR(cfg =>
        {
            cfg.RegisterServicesFromAssemblies(
                typeof(AssemblyMarker).Assembly,     // Application
                typeof(VisaDbContext).Assembly);     // Infrastructure (handlers)

            cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(LoggingBehavior<,>));
            cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(ValidationBehavior<,>));
        });

        services.AddValidatorsFromAssembly(typeof(AssemblyMarker).Assembly);

        // Channel credential encryption at rest (over the gateway's Data Protection key ring).
        services.AddScoped<Application.Abstractions.IVisaSecretProtector, Channels.DataProtectionVisaSecretProtector>();

        return services;
    }

    public static async Task MigrateAndSeedVisaServicesAsync(this IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<VisaDbContext>();
        await db.Database.MigrateAsync();

        // VisaType is now tenant-owned + seeded lazily per tenant (GetVisaTypesHandler).
        // Remove any legacy GLOBAL (TenantId NULL) rows left by the earlier global seed —
        // they're invisible to every tenant under the new query filter. Idempotent.
        var orphans = await db.VisaTypes.IgnoreQueryFilters()
            .Where(t => EF.Property<Guid?>(t, "TenantId") == null)
            .ToListAsync();
        if (orphans.Count > 0)
        {
            db.VisaTypes.RemoveRange(orphans);
            await db.SaveChangesAsync();
        }
    }
}
