using Softaxis.BuildingBlocks.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Softaxis.BuildingBlocks.Infrastructure.Seeding;
using Microsoft.Extensions.DependencyInjection;
using Softaxis.POS.Application.Abstractions;
using Softaxis.POS.Domain.Repositories;
using Softaxis.POS.Infrastructure.Persistence;
using Softaxis.POS.Infrastructure.Persistence.Repositories;
using Softaxis.POS.Infrastructure.Persistence.Seed;
using Softaxis.POS.Infrastructure.Security;
using Softaxis.POS.Infrastructure.Services;

namespace Softaxis.POS.Infrastructure.Extensions;

public static class InfrastructureExtensions
{
    public static IServiceCollection AddPOSInfrastructure(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        // Database
        services.AddDbContext<POSDbContext>(opts =>
            opts.UseSqlServer(
                configuration.GetConnectionString("POSDb"),
                sql => sql.MigrationsAssembly(typeof(POSDbContext).Assembly.FullName)));

        // Cloud-side guard for a branch that runs on its own server (docs/branch-server-design.md §7).
        // A no-op unless BranchSync:Mode is Cloud. Open behaviour only: the handlers themselves are
        // registered by the host.
        services.AddMediatR(cfg =>
        {
            cfg.RegisterServicesFromAssemblies(typeof(POSDbContext).Assembly);
            cfg.AddOpenBehavior(typeof(LocalBranchBehavior<,>));
        });

        // Repositories
        services.AddScoped<IProductRepository,         ProductRepository>();
        services.AddSingleton<Softaxis.POS.Application.Catalogue.ICatalogueProvider, Softaxis.POS.Infrastructure.Catalogue.EmbeddedCatalogueProvider>();
        services.AddScoped<IProductCategoryRepository, ProductCategoryRepository>();
        services.AddScoped<ICustomerRepository,        CustomerRepository>();
        services.AddScoped<ICustomerWalletTransactionRepository, CustomerWalletTransactionRepository>();
        services.AddScoped<IPaymentGatewayConfigRepository, PaymentGatewayConfigRepository>();
        services.AddScoped<IPOSSessionRepository,      POSSessionRepository>();
        services.AddScoped<IPOSTransactionRepository,  POSTransactionRepository>();
        services.AddScoped<IStockMovementRepository,   StockMovementRepository>();
        services.AddScoped<IHeldTransactionRepository,       HeldTransactionRepository>();
        services.AddScoped<IPaymentMethodConfigRepository,  PaymentMethodConfigRepository>();
        services.AddScoped<ICurrencyRepository,             CurrencyRepository>();
        services.AddScoped<ITaxRateRepository,              TaxRateRepository>();
        services.AddScoped<IVoucherRepository,              VoucherRepository>();
        services.AddScoped<ICashMovementRepository,         CashMovementRepository>();
        services.AddScoped<IPosSettingsRepository,          PosSettingsRepository>();
        services.AddScoped<IPaymentTermRepository,          PaymentTermRepository>();
        services.AddScoped<ICustomerGroupRepository,        CustomerGroupRepository>();
        services.AddScoped<IVendorRepository,               VendorRepository>();
        services.AddScoped<IPurchaseOrderRepository,        PurchaseOrderRepository>();
        services.AddScoped<ISalesOrderRepository,           SalesOrderRepository>();
        services.AddScoped<ISalesQuotationRepository,       SalesQuotationRepository>();
        services.AddScoped<IUnitOfWork,                     UnitOfWork>();

        // Services
        services.AddScoped<IReportService,               ReportService>();
        services.AddScoped<IPosDashboardReadService,     PosDashboardReadService>();
        services.AddScoped<IPosCreditReadService,        PosCreditReadService>();
        services.AddScoped<Softaxis.POS.Infrastructure.Services.CreditReminderService>();
        services.AddScoped<Softaxis.POS.Application.Customers.Credit.Reminders.ICreditReminderService>(sp => sp.GetRequiredService<Softaxis.POS.Infrastructure.Services.CreditReminderService>());
        services.AddSingleton<Softaxis.POS.Infrastructure.Services.ICreditMailSender, Softaxis.POS.Infrastructure.Services.SmtpCreditMailSender>();
        services.AddHostedService<Softaxis.POS.Infrastructure.Services.CreditReminderBackgroundService>();
        services.AddScoped<ILowStockReadService,         LowStockReadService>();
        services.AddScoped<ICrossSchemaProductService,   CrossSchemaProductService>();
        services.AddSingleton<ISecretProtector, DataProtectionSecretProtector>();

        // FBR (Pakistan) POS integration: client, reporter, and the retry queue.
        services.AddHttpClient(Softaxis.POS.Infrastructure.Fbr.FbrHttpClient.HttpClientName,
            c => c.Timeout = TimeSpan.FromSeconds(10));
        services.AddScoped<Softaxis.POS.Application.Fbr.IFbrClient, Softaxis.POS.Infrastructure.Fbr.FbrHttpClient>();
        services.AddScoped<Softaxis.POS.Application.Fbr.FbrReporter>();
        services.AddHostedService<Softaxis.POS.Infrastructure.Fbr.FbrRetryBackgroundService>();

        return services;
    }

    public static async Task MigrateAndSeedPOSAsync(this IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<POSDbContext>();
        await db.Database.MigrateTolerantOfLockReleaseAsync();

        // One-time repair (idempotent): stock movements written by the old raw-SQL POS
        // sale/refund path landed with TenantId = NULL (raw SQL bypasses StampTenantId), so
        // the tenant query filter hid them from their own tenant. Stamp from the owning product.
        await db.Database.ExecuteSqlRawAsync("""
            UPDATE m SET m.TenantId = p.TenantId
            FROM [pos].[stock_movements] m
            JOIN [pos].[products] p ON p.Id = m.ProductId
            WHERE m.TenantId IS NULL AND p.TenantId IS NOT NULL
            """);

        if (DemoTenantSeeder.Enabled(scope.ServiceProvider))
            await DemoTenantSeeder.RunAsync(() => POSSeedData.SeedAsync(db));
        else if (DemoSeedGate.DemoEnabled(scope.ServiceProvider))
            await POSSeedData.SeedAsync(db);
    }
}
