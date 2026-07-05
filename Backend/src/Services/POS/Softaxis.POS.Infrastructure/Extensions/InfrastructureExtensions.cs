using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Softaxis.POS.Application.Abstractions;
using Softaxis.POS.Domain.Repositories;
using Softaxis.POS.Infrastructure.Persistence;
using Softaxis.POS.Infrastructure.Persistence.Repositories;
using Softaxis.POS.Infrastructure.Persistence.Seed;
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

        // Repositories
        services.AddScoped<IProductRepository,         ProductRepository>();
        services.AddScoped<IProductCategoryRepository, ProductCategoryRepository>();
        services.AddScoped<ICustomerRepository,        CustomerRepository>();
        services.AddScoped<IPOSSessionRepository,      POSSessionRepository>();
        services.AddScoped<IPOSTransactionRepository,  POSTransactionRepository>();
        services.AddScoped<IStockMovementRepository,   StockMovementRepository>();
        services.AddScoped<IHeldTransactionRepository,       HeldTransactionRepository>();
        services.AddScoped<IPaymentMethodConfigRepository,  PaymentMethodConfigRepository>();
        services.AddScoped<ICurrencyRepository,             CurrencyRepository>();
        services.AddScoped<ITaxRateRepository,              TaxRateRepository>();
        services.AddScoped<IVoucherRepository,              VoucherRepository>();
        services.AddScoped<ICashMovementRepository,         CashMovementRepository>();
        services.AddScoped<IPaymentTermRepository,          PaymentTermRepository>();
        services.AddScoped<ICustomerGroupRepository,        CustomerGroupRepository>();
        services.AddScoped<IVendorRepository,               VendorRepository>();
        services.AddScoped<IPurchaseOrderRepository,        PurchaseOrderRepository>();
        services.AddScoped<ISalesOrderRepository,           SalesOrderRepository>();
        services.AddScoped<ISalesQuotationRepository,       SalesQuotationRepository>();
        services.AddScoped<IUnitOfWork,                     UnitOfWork>();

        // Services
        services.AddScoped<IReportService,               ReportService>();
        services.AddScoped<ICrossSchemaProductService,   CrossSchemaProductService>();

        return services;
    }

    public static async Task MigrateAndSeedPOSAsync(this IServiceProvider services)
    {
        using var scope = services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<POSDbContext>();
        await db.Database.MigrateAsync();

        // One-time repair (idempotent): stock movements written by the old raw-SQL POS
        // sale/refund path landed with TenantId = NULL (raw SQL bypasses StampTenantId), so
        // the tenant query filter hid them from their own tenant. Stamp from the owning product.
        await db.Database.ExecuteSqlRawAsync("""
            UPDATE m SET m.TenantId = p.TenantId
            FROM [pos].[stock_movements] m
            JOIN [pos].[products] p ON p.Id = m.ProductId
            WHERE m.TenantId IS NULL AND p.TenantId IS NOT NULL
            """);

        await POSSeedData.SeedAsync(db);
    }
}
