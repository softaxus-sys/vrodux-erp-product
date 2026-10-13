using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Softaxis.BuildingBlocks.Application.Behaviors;
using Softaxis.BuildingBlocks.Infrastructure.Persistence;
using Softaxis.Calendar.Application;
using Softaxis.Calendar.Application.Abstractions;
using Softaxis.Calendar.Infrastructure.Google;
using Softaxis.Calendar.Infrastructure.Persistence;
using Softaxis.Calendar.Infrastructure.Security;
using Softaxis.Calendar.Infrastructure.Sync;

namespace Softaxis.Calendar.Infrastructure.Extensions;

public static class InfrastructureExtensions
{
    public static IServiceCollection AddCalendarInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddDbContext<CalendarDbContext>(opts =>
            opts.UseSqlServer(
                // Falls back to the Identity database like AiAssistant/Notifications, so a missing key is never fatal at startup.
                configuration.GetConnectionString("CalendarDb") ?? configuration.GetConnectionString("IdentityDb"),
                sql => sql.MigrationsAssembly(typeof(CalendarDbContext).Assembly.FullName)));

        services.AddMediatR(cfg =>
        {
            cfg.RegisterServicesFromAssemblies(typeof(AssemblyMarker).Assembly, typeof(CalendarDbContext).Assembly);
            cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(LoggingBehavior<,>));
            cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(ValidationBehavior<,>));
        });
        services.AddValidatorsFromAssembly(typeof(AssemblyMarker).Assembly);

        services.AddScoped<ISecretProtector, DataProtectionSecretProtector>();
        services.Configure<GoogleCalendarOptions>(configuration.GetSection(GoogleCalendarOptions.Section));
        services.AddHttpClient("google-calendar", c => c.Timeout = TimeSpan.FromSeconds(30));
        services.AddScoped<GoogleCalendarClient>();
        services.AddScoped<GoogleCalendarSync>();

        services.TryAddSingleton<BuildingBlocks.Application.Multitenancy.ITenantWorkFilter,
            BuildingBlocks.Application.Multitenancy.AllowAllTenantWorkFilter>();
        services.AddHostedService<CalendarSyncBackgroundService>();
        return services;
    }

    public static async Task MigrateAndSeedCalendarAsync(this IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<CalendarDbContext>();
        await db.Database.MigrateTolerantOfLockReleaseAsync();
    }
}
