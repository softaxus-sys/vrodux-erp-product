using Softaxis.BuildingBlocks.Infrastructure.Persistence;
using FluentValidation;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Softaxis.BuildingBlocks.Infrastructure.Seeding;
using Microsoft.Extensions.DependencyInjection;
using Softaxis.BuildingBlocks.Application.Behaviors;
using Softaxis.Purchase.Application.GoodsReceiptNotes.Commands;
using Softaxis.Purchase.Infrastructure.Handlers.GoodsReceiptNotes;
using Softaxis.Purchase.Infrastructure.Persistence;
using Softaxis.Purchase.Infrastructure.Persistence.Seed;

namespace Softaxis.Purchase.Infrastructure.Extensions;

public static class InfrastructureExtensions
{
    public static IServiceCollection AddPurchaseInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        services.AddDbContext<PurchaseDbContext>(opts =>
            opts.UseSqlServer(
                configuration.GetConnectionString("PurchaseDb"),
                sql => sql.MigrationsAssembly(typeof(PurchaseDbContext).Assembly.FullName)));

        // ── MediatR — scan Application + Infrastructure for handlers ─────────
        services.AddMediatR(cfg =>
        {
            cfg.RegisterServicesFromAssemblies(
                typeof(CreateGoodsReceiptNoteCommand).Assembly,   // Application
                typeof(CreateGoodsReceiptNoteHandler).Assembly);  // Infrastructure

            cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(LoggingBehavior<,>));
            cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(ValidationBehavior<,>));
        });

        // ── FluentValidation — register all validators from Application ───────
        services.AddValidatorsFromAssembly(typeof(CreateGoodsReceiptNoteCommand).Assembly);

        return services;
    }

    public static async Task MigrateAndSeedPurchaseAsync(this IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<PurchaseDbContext>();
        await db.Database.MigrateTolerantOfLockReleaseAsync();
        if (DemoTenantSeeder.Enabled(scope.ServiceProvider))
            await DemoTenantSeeder.RunAsync(() => PurchaseSeedData.SeedAsync(db));
        else if (DemoSeedGate.DemoEnabled(scope.ServiceProvider))
            await PurchaseSeedData.SeedAsync(db);
    }
}
