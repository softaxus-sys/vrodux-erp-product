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
                configuration.GetConnectionString("SupportDb"),
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
