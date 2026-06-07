using MediatR;
using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Infrastructure.Persistence;
using Softaxis.POS.Domain.Entities;

namespace Softaxis.POS.Infrastructure.Persistence;

public sealed class POSDbContext(DbContextOptions<POSDbContext> options, IMediator mediator)
    : BaseDbContext(options, mediator)
{
    public DbSet<Product>         Products         => Set<Product>();
    public DbSet<ProductCategory> ProductCategories => Set<ProductCategory>();
    public DbSet<Customer>        Customers         => Set<Customer>();
    public DbSet<POSSession>      Sessions          => Set<POSSession>();
    public DbSet<POSTransaction>  Transactions      => Set<POSTransaction>();
    public DbSet<POSLineItem>     LineItems         => Set<POSLineItem>();
    public DbSet<POSPayment>      Payments          => Set<POSPayment>();
    public DbSet<HeldTransaction> HeldTransactions  => Set<HeldTransaction>();
    public DbSet<StockMovement>   StockMovements    => Set<StockMovement>();
    public DbSet<PaymentMethodConfig> PaymentMethodConfigs => Set<PaymentMethodConfig>();
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
        TenantIsolation.ApplyTenantId(modelBuilder, tenantOwned);

        base.OnModelCreating(modelBuilder);
    }
}
