using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Softaxis.BuildingBlocks.Application.Behaviors;
using Softaxis.BuildingBlocks.Infrastructure.Seeding;
using Microsoft.Extensions.DependencyInjection;
using Softaxis.Restaurant.Application.Abstractions;
using Softaxis.Restaurant.Application.Delivery.Abstractions;
using Softaxis.Restaurant.Application.Tables.Commands;
using Softaxis.Restaurant.Infrastructure.Delivery;
using Softaxis.Restaurant.Infrastructure.Handlers.Tables;
using Softaxis.Restaurant.Infrastructure.Persistence;
using Softaxis.Restaurant.Infrastructure.Persistence.Seed;
using Softaxis.Restaurant.Infrastructure.Services;

namespace Softaxis.Restaurant.Infrastructure.Extensions;

public static class InfrastructureExtensions
{
    public static IServiceCollection AddRestaurantInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddDbContext<RestaurantDbContext>(opts =>
            opts.UseSqlServer(configuration.GetConnectionString("RestaurantDb"),
                sql => sql.MigrationsAssembly(typeof(RestaurantDbContext).Assembly.FullName)));

        // ── MediatR — scan Application + Infrastructure for handlers ─────────
        services.AddMediatR(cfg =>
        {
            cfg.RegisterServicesFromAssemblies(
                typeof(CreateTableCommand).Assembly,   // Application
                typeof(CreateTableHandler).Assembly);  // Infrastructure

            cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(LoggingBehavior<,>));
            cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(ValidationBehavior<,>));
        });

        // ── FluentValidation — register all validators from Application ───────
        services.AddValidatorsFromAssembly(typeof(CreateTableCommand).Assembly);

        // ── Background jobs ─────────────────────────────────────────────────
        services.AddHostedService<ReservationNoShowService>();

        // ── Delivery provider registry (Epic 6) — "manual" is the only real channel;
        //    the rest are catalog stubs until a tenant configures real credentials ──
        services.AddSingleton<IDeliveryProvider, ManualDeliveryProvider>();
        services.AddSingleton<IDeliveryProvider>(new StubDeliveryProvider("talabat", "Talabat"));
        services.AddSingleton<IDeliveryProvider>(new StubDeliveryProvider("careem", "Careem"));
        services.AddSingleton<IDeliveryProvider>(new StubDeliveryProvider("deliveroo", "Deliveroo"));
        services.AddSingleton<IDeliveryProvider>(new StubDeliveryProvider("ubereats", "Uber Eats"));
        services.AddSingleton<IDeliveryProviderRegistry, DeliveryProviderRegistry>();

        // ── Digital receipts (Epic 6) ───────────────────────────────────────
        services.AddScoped<IReceiptEmailService, SmtpReceiptEmailService>();

        // ── Branch scoping (Epic 9) ──────────────────────────────────────────
        services.AddScoped<IBranchAccessGuard, BranchAccessGuard>();

        // ── Secret encryption (Epic 9 — SMS/WhatsApp provider credentials) ──
        services.AddSingleton<ISecretProtector, DataProtectionSecretProtector>();

        // ── SMS/WhatsApp (Epic 9) — real Twilio client, per-tenant configured;
        //    both interfaces resolve to the same scoped instance ─────────────
        services.AddHttpClient("twilio");
        services.AddScoped<TwilioNotificationProvider>();
        services.AddScoped<ISmsProvider>(sp => sp.GetRequiredService<TwilioNotificationProvider>());
        services.AddScoped<IWhatsAppProvider>(sp => sp.GetRequiredService<TwilioNotificationProvider>());

        return services;
    }

    public static async Task MigrateAndSeedRestaurantAsync(this IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<RestaurantDbContext>();
        await db.Database.MigrateAsync();

        // One-time repair (idempotent): payment rows written by the old raw-SQL RecordPayment
        // landed with TenantId = NULL (raw SQL bypasses StampTenantId), so the tenant query
        // filter hid them from their own tenant. Stamp them from the parent order.
        await db.Database.ExecuteSqlRawAsync("""
            UPDATE p SET p.TenantId = o.TenantId
            FROM [restaurant].[OrderPayments] p
            JOIN [restaurant].[Orders] o ON o.Id = p.OrderId
            WHERE p.TenantId IS NULL AND o.TenantId IS NOT NULL
            """);

        if (DemoTenantSeeder.Enabled(scope.ServiceProvider))
            await DemoTenantSeeder.RunAsync(() => RestaurantSeedData.SeedAsync(db));
        else if (DemoSeedGate.DemoEnabled(scope.ServiceProvider))
            await RestaurantSeedData.SeedAsync(db);
    }
}
