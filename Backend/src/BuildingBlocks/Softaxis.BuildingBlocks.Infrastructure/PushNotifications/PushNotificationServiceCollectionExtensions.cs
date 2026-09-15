using Microsoft.Extensions.DependencyInjection;
using Softaxis.BuildingBlocks.Application.PushNotifications;

namespace Softaxis.BuildingBlocks.Infrastructure.PushNotifications;

public static class PushNotificationServiceCollectionExtensions
{
    /// <summary>Registers the shared Expo push sender. Call once from any service's own
    /// AddXInfrastructure that needs to notify a user's phone.</summary>
    public static IServiceCollection AddExpoPushNotifications(this IServiceCollection services)
    {
        services.AddHttpClient("expo-push");
        services.AddSingleton<IPushNotificationSender, ExpoPushNotificationSender>();
        return services;
    }
}
