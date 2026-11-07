using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Softaxis.BuildingBlocks.Application.Behaviors;
using Softaxis.BuildingBlocks.Infrastructure.Persistence;
using Softaxis.Ecommerce.Application;
using Softaxis.Ecommerce.Application.Abstractions;
using Softaxis.Ecommerce.Infrastructure.Persistence;
using Softaxis.Ecommerce.Infrastructure.Services;
using Softaxis.Ecommerce.Infrastructure.Handlers.Shop;
using Softaxis.Ecommerce.Infrastructure.Services.Shop;
using Softaxis.Ecommerce.Infrastructure.Services.Shopify;

namespace Softaxis.Ecommerce.Infrastructure.Extensions;

public static class InfrastructureExtensions
{
    public static IServiceCollection AddEcommerceInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        // Every service shares one database; falling back to IdentityDb means a deployment that
        // has not been given an EcommerceDb key still starts.
        var connection = configuration.GetConnectionString("EcommerceDb")
                         ?? configuration.GetConnectionString("IdentityDb");

        services.AddDbContext<EcommerceDbContext>(opts =>
            opts.UseSqlServer(connection,
                sql => sql.MigrationsAssembly(typeof(EcommerceDbContext).Assembly.FullName)));

        services.AddMediatR(cfg =>
        {
            cfg.RegisterServicesFromAssemblies(
                typeof(AssemblyMarker).Assembly,            // Application
                typeof(EcommerceDbContext).Assembly);       // Infrastructure (handlers)

            cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(LoggingBehavior<,>));
            cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(ValidationBehavior<,>));
        });
        services.AddValidatorsFromAssembly(typeof(AssemblyMarker).Assembly);

        services.AddHttpClient(ShopifyProvider.HttpClientName, c => c.Timeout = TimeSpan.FromSeconds(60));
        services.AddScoped<IChannelProvider, ShopifyProvider>();
        services.AddScoped<IChannelProviders, ChannelProviders>();
        services.AddSingleton<ISecretProtector, DataProtectionSecretProtector>();

        // Requires AddInventoryInfrastructure: listings, photos and stock are Inventory's.
        services.AddScoped<IInventoryCatalogue, InventoryCatalogue>();
        services.AddScoped<ChannelSyncService>();

        services.AddHostedService<ChannelSyncWorker>();

        // ── The workspace's own storefront ──
        services.AddHttpClient(StripeGateway.ClientName, c => c.Timeout = TimeSpan.FromSeconds(30));
        services.AddHttpClient(PayPalGateway.ClientName, c => c.Timeout = TimeSpan.FromSeconds(30));
        services.AddSingleton<ShopLinks>();
        services.AddSingleton<IShopSecurity, ShopSecurity>();
        services.AddSingleton<IShopMailer, SmtpShopMailer>();
        services.AddScoped<StripeGateway>();
        services.AddScoped<PayPalGateway>();
        services.AddScoped<ShopGate>();
        services.AddScoped<StorePricing>();
        services.AddScoped<StoreOrderService>();
        services.AddScoped<PaymentStarter>();
        services.AddHostedService<StoreOrderExpiryWorker>();
        return services;
    }

    public static async Task MigrateAndSeedEcommerceAsync(this IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<EcommerceDbContext>();
        await db.Database.MigrateTolerantOfLockReleaseAsync();
    }
}
