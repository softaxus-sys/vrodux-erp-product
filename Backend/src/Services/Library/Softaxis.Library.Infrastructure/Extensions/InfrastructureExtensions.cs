using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Softaxis.BuildingBlocks.Application.Behaviors;
using Softaxis.BuildingBlocks.Infrastructure.Persistence;
using Softaxis.Library.Application;
using Softaxis.Library.Application.Abstractions;
using Softaxis.Library.Application.Reminders;
using Softaxis.Library.Infrastructure.Persistence;
using Softaxis.Library.Infrastructure.Services;

namespace Softaxis.Library.Infrastructure.Extensions;

public static class InfrastructureExtensions
{
    public static IServiceCollection AddLibraryInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        // Every service shares one database; falling back to IdentityDb means a deployment that
        // has not been given a LibraryDb key still starts.
        var connection = configuration.GetConnectionString("LibraryDb")
                         ?? configuration.GetConnectionString("IdentityDb");

        services.AddDbContext<LibraryDbContext>(opts =>
            opts.UseSqlServer(connection,
                sql => sql.MigrationsAssembly(typeof(LibraryDbContext).Assembly.FullName)));

        services.AddMediatR(cfg =>
        {
            cfg.RegisterServicesFromAssemblies(
                typeof(AssemblyMarker).Assembly,        // Application
                typeof(LibraryDbContext).Assembly);     // Infrastructure (handlers)

            cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(LoggingBehavior<,>));
            cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(ValidationBehavior<,>));
        });

        services.AddValidatorsFromAssembly(typeof(AssemblyMarker).Assembly);

        // Staff assigned to a branch are limited to it. Needs the host to register ICurrentUser.
        services.AddScoped<IBranchAccess, BranchAccess>();

        // Member notices: due soon, overdue, reserved copy ready. Off per workspace until enabled.
        services.AddScoped<ILibraryEmailService, SmtpLibraryEmailService>();
        services.AddScoped<ILibraryReminderSender, LibraryReminderSender>();
        services.AddHostedService<LibraryReminderBackgroundService>();

        // Member portal: PIN hashing and the signed session a member holds after signing in.
        services.AddSingleton<IPortalSecurity, PortalSecurity>();

        return services;
    }

    public static async Task MigrateAndSeedLibraryAsync(this IServiceProvider services)
    {
        // Migrate only. Default branch and membership types are created per tenant on first read:
        // a startup seed has no tenant, so its rows would be invisible to every workspace.
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<LibraryDbContext>();
        await db.Database.MigrateTolerantOfLockReleaseAsync();
    }
}
