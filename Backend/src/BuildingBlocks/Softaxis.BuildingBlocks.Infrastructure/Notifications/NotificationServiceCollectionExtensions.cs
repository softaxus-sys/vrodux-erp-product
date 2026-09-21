using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Softaxis.BuildingBlocks.Application.Notifications;
using Softaxis.BuildingBlocks.Infrastructure.Persistence;

namespace Softaxis.BuildingBlocks.Infrastructure.Notifications;

public static class NotificationServiceCollectionExtensions
{
    /// <summary>
    /// Registers the shared notification store and publisher. Call once in the host (the gateway).
    ///
    /// <para>The realtime notifier is NOT registered here — it is SignalR, which BuildingBlocks must
    /// not reference if every service is to keep depending on it. The host registers its own
    /// <see cref="INotificationRealtimeNotifier"/>; without one, publishing still stores rows and the
    /// bell still works on its poll, it simply loses the instant push.</para>
    /// </summary>
    public static IServiceCollection AddNotifications(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddDbContext<NotificationsDbContext>(opts =>
            opts.UseSqlServer(
                configuration.GetConnectionString("NotificationsDb")
                    // Every service points at the same physical database with its own schema, so
                    // falling back keeps an existing deployment working without a new env var.
                    ?? configuration.GetConnectionString("IdentityDb"),
                sql => sql.MigrationsAssembly(typeof(NotificationsDbContext).Assembly.FullName)));

        services.AddScoped<INotificationDispatcher, NotificationPublisher>();
        services.AddScoped<INotificationRecipients, NotificationRecipientResolver>();
        return services;
    }

    public static async Task MigrateNotificationsAsync(this IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<NotificationsDbContext>();
        await db.Database.MigrateTolerantOfLockReleaseAsync();
        await NotificationBackfill.CopyLegacyCrmNotificationsAsync(db, scope.ServiceProvider);
    }
}
