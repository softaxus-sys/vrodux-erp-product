using MediatR;
using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Infrastructure.Persistence;
using Softaxis.POS.Domain.Entities;

namespace Softaxis.POS.Infrastructure.Persistence;

public sealed class POSDbContext(DbContextOptions<POSDbContext> options, IMediator mediator)
    : BaseDbContext(options, mediator), ITenantAmbientContext
{
    public DbSet<Product>         Products         => Set<Product>();
    public DbSet<ProductCategory> ProductCategories => Set<ProductCategory>();
    public DbSet<Customer>        Customers         => Set<Customer>();
    public DbSet<CustomerWalletTransaction> CustomerWalletTransactions => Set<CustomerWalletTransaction>();
    public DbSet<POSSession>      Sessions          => Set<POSSession>();
    public DbSet<POSTransaction>  Transactions      => Set<POSTransaction>();
    public DbSet<POSLineItem>     LineItems         => Set<POSLineItem>();
    public DbSet<POSPayment>      Payments          => Set<POSPayment>();
    public DbSet<HeldTransaction> HeldTransactions  => Set<HeldTransaction>();
    public DbSet<StockMovement>   StockMovements    => Set<StockMovement>();
    public DbSet<PaymentMethodConfig> PaymentMethodConfigs => Set<PaymentMethodConfig>();
    public DbSet<PaymentGatewayConfig> PaymentGatewayConfigs => Set<PaymentGatewayConfig>();
    public DbSet<Currency>            Currencies           => Set<Currency>();
    public DbSet<TaxRate>             TaxRates             => Set<TaxRate>();
    public DbSet<PaymentTerm>         PaymentTerms         => Set<PaymentTerm>();
    public DbSet<CustomerGroup>       CustomerGroups       => Set<CustomerGroup>();
    public DbSet<Voucher>             Vouchers             => Set<Voucher>();
    public DbSet<CashMovement>        CashMovements        => Set<CashMovement>();

    // Vendors & Purchase
    public DbSet<Vendor>            Vendors              => Set<Vendor>();
    public DbSet<PurchaseOrder>     PurchaseOrders       => Set<PurchaseOrder>();
    public DbSet<PurchaseOrderItem> PurchaseOrderItems   => Set<PurchaseOrderItem>();

    // Sales Orders & Quotations
    public DbSet<SalesOrder>        SalesOrders          => Set<SalesOrder>();
    public DbSet<SalesOrderItem>    SalesOrderItems      => Set<SalesOrderItem>();
    public DbSet<SalesQuotation>    SalesQuotations      => Set<SalesQuotation>();
    public DbSet<SalesQuotationItem> SalesQuotationItems => Set<SalesQuotationItem>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("pos");
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(POSDbContext).Assembly);

        var tenantOwned = modelBuilder.Model.GetEntityTypes()
            .Where(t => !t.IsOwned() && t.FindPrimaryKey() != null
                     && t.ClrType.Namespace?.StartsWith("Softaxis.POS.Domain") == true)
            .Select(t => t.ClrType).Distinct().ToList();
        TenantIsolation.ApplyTenantId(modelBuilder, this, tenantOwned);

        // Per-tenant business keys: unique within the tenant, live rows only. These were global
        // unique indexes, so one tenant's barcode/SKU/code/customer phone blocked every other
        // tenant from using the same value — and a soft-deleted row kept its claim forever.
        TenantIsolation.TenantUniqueIndex<Currency>(modelBuilder, [nameof(Currency.Code)]);
        TenantIsolation.TenantUniqueIndex<Customer>(modelBuilder, [nameof(Customer.Phone)], extraFilter: "[phone] IS NOT NULL");
        TenantIsolation.TenantUniqueIndex<CustomerGroup>(modelBuilder, [nameof(CustomerGroup.Code)]);
        TenantIsolation.TenantUniqueIndex<POSTransaction>(modelBuilder, [nameof(POSTransaction.TransactionNumber)]);
        TenantIsolation.TenantUniqueIndex<PaymentMethodConfig>(modelBuilder, [nameof(PaymentMethodConfig.Code)]);
        TenantIsolation.TenantUniqueIndex<PaymentTerm>(modelBuilder, [nameof(PaymentTerm.Code)]);
        TenantIsolation.TenantUniqueIndex<ProductCategory>(modelBuilder, [nameof(ProductCategory.Name)]);
        TenantIsolation.TenantUniqueIndex<Product>(modelBuilder, [nameof(Product.Barcode)], extraFilter: "[barcode] IS NOT NULL");
        TenantIsolation.TenantUniqueIndex<Product>(modelBuilder, [nameof(Product.SKU)], extraFilter: "[sku] IS NOT NULL");
        TenantIsolation.TenantUniqueIndex<PurchaseOrder>(modelBuilder, [nameof(PurchaseOrder.OrderNumber)]);
        TenantIsolation.TenantUniqueIndex<SalesOrder>(modelBuilder, [nameof(SalesOrder.OrderNumber)]);
        TenantIsolation.TenantUniqueIndex<SalesQuotation>(modelBuilder, [nameof(SalesQuotation.QuotationNumber)]);
        TenantIsolation.TenantUniqueIndex<TaxRate>(modelBuilder, [nameof(TaxRate.Code)]);
        TenantIsolation.TenantUniqueIndex<Vendor>(modelBuilder, [nameof(Vendor.Code)], extraFilter: "[Code] IS NOT NULL");
        TenantIsolation.TenantUniqueIndex<Voucher>(modelBuilder, [nameof(Voucher.Code)]);

        base.OnModelCreating(modelBuilder);
    }
}
