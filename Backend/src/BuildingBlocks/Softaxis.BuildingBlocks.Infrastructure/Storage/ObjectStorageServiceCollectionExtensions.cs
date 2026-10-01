using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Softaxis.BuildingBlocks.Application.Storage;

namespace Softaxis.BuildingBlocks.Infrastructure.Storage;

public static class ObjectStorageServiceCollectionExtensions
{
    /// <summary>Registers the shared object-storage client. Call once in the host (the gateway) —
    /// every service's handlers then inject IObjectStorage directly, the same shape as
    /// INotificationDispatcher.</summary>
    public static IServiceCollection AddObjectStorage(this IServiceCollection services, IConfiguration configuration)
    {
        services.Configure<ObjectStorageOptions>(configuration.GetSection(ObjectStorageOptions.Section));
        services.AddSingleton<IObjectStorage, S3ObjectStorage>();
        return services;
    }
}
