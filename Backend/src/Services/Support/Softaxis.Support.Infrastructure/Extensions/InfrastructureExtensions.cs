using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Softaxis.BuildingBlocks.Application.Behaviors;
using Softaxis.BuildingBlocks.Infrastructure.Persistence;
using Softaxis.Support.Application;
using Softaxis.Support.Application.Abstractions;
using Softaxis.Support.Application.Options;
using Softaxis.Support.Infrastructure.Persistence;
using Softaxis.Support.Infrastructure.Services;

namespace Softaxis.Support.Infrastructure.Extensions;

public static class InfrastructureExtensions
{
    public static IServiceCollection AddSupportInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddDbContext<SupportDbContext>(opts =>
            opts.UseSqlServer(
                // Falls back to IdentityDb when SupportDb is unset — every service points at the same
                // physical database with its own schema, and a missing key here used to take the WHOLE
                // gateway down at startup with "The ConnectionString property has not been initialized."
                // AiAssistant and Notifications already fall back the same way.
                configuration.GetConnectionString("SupportDb")
                    ?? configuration.GetConnectionString("IdentityDb"),
                sql => sql.MigrationsAssembly(typeof(SupportDbContext).Assembly.FullName)));

        services.Configure<SupportOptions>(configuration.GetSection(SupportOptions.SectionName));

        services.AddMediatR(cfg =>
        {
            cfg.RegisterServicesFromAssemblies(
                typeof(AssemblyMarker).Assembly,   // Application
                typeof(SupportDbContext).Assembly); // Infrastructure (handlers)

            cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(LoggingBehavior<,>));
            cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(ValidationBehavior<,>));
        });

        services.AddValidatorsFromAssembly(typeof(AssemblyMarker).Assembly);

        services.AddScoped<ISupportAccessGuard, SupportAccessGuard>();
        services.AddScoped<ISupportEmailService, SmtpSupportEmailService>();

        return services;
    }

    public static async Task MigrateAndSeedSupportAsync(this IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<SupportDbContext>();
        await db.Database.MigrateTolerantOfLockReleaseAsync();
    }
}
