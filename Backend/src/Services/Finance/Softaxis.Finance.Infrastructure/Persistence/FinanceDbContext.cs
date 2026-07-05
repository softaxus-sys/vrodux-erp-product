using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Infrastructure.Persistence;
using Softaxis.Finance.Domain.Entities;

namespace Softaxis.Finance.Infrastructure.Persistence;

public sealed class FinanceDbContext(DbContextOptions<FinanceDbContext> options)
    : DbContext(options)
{
    public DbSet<Account>          Accounts         => Set<Account>();
    public DbSet<JournalEntry>     JournalEntries   => Set<JournalEntry>();
    public DbSet<JournalEntryLine> JournalLines     => Set<JournalEntryLine>();
    public DbSet<Invoice>          Invoices         => Set<Invoice>();
    public DbSet<InvoiceItem>      InvoiceItems     => Set<InvoiceItem>();
    public DbSet<Expense>          Expenses         => Set<Expense>();
    public DbSet<Budget>           Budgets          => Set<Budget>();
    public DbSet<BudgetLine>       BudgetLines      => Set<BudgetLine>();
    public DbSet<BankAccount>      BankAccounts     => Set<BankAccount>();
    public DbSet<BankTransaction>  BankTransactions => Set<BankTransaction>();
    public DbSet<TaxPeriod>        TaxPeriods       => Set<TaxPeriod>();
    public DbSet<TaxTransaction>   TaxTransactions  => Set<TaxTransaction>();
    public DbSet<RecurringInvoice>     RecurringInvoices     => Set<RecurringInvoice>();
    public DbSet<RecurringInvoiceLine> RecurringInvoiceLines => Set<RecurringInvoiceLine>();
    public DbSet<AccountType>          AccountTypes          => Set<AccountType>();
    public DbSet<Currency>             Currencies            => Set<Currency>();
    public DbSet<ExchangeRate>         ExchangeRates         => Set<ExchangeRate>();
    public DbSet<Customer>             Customers             => Set<Customer>();
    public DbSet<Supplier>             Suppliers             => Set<Supplier>();
    public DbSet<PurchaseBill>         PurchaseBills         => Set<PurchaseBill>();
    public DbSet<PurchaseBillItem>     PurchaseBillItems     => Set<PurchaseBillItem>();
    public DbSet<PaymentVoucher>       PaymentVouchers       => Set<PaymentVoucher>();
    public DbSet<PaymentAllocation>    PaymentAllocations    => Set<PaymentAllocation>();
    public DbSet<ReceiptVoucher>       ReceiptVouchers       => Set<ReceiptVoucher>();
    public DbSet<ReceiptAllocation>    ReceiptAllocations    => Set<ReceiptAllocation>();
    public DbSet<FiscalPeriod>         FiscalPeriods         => Set<FiscalPeriod>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("finance");
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(FinanceDbContext).Assembly);
        // Currency + ExchangeRate are GLOBAL reference data (market rates are universal) — exclude them
        // from tenant isolation so they are shared across tenants and not hidden by a NULL TenantId.
        TenantIsolation.ApplyTenantId(modelBuilder, "Softaxis.Finance.Domain",
            exclude: [typeof(Currency), typeof(ExchangeRate)]);
        base.OnModelCreating(modelBuilder);
    }

    public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        TenantIsolation.StampTenantId(ChangeTracker);
        var now = DateTime.UtcNow;
        foreach (var entry in ChangeTracker.Entries())
        {
            if (entry.State == EntityState.Added)
            {
                if (entry.Properties.Any(p => p.Metadata.Name == "CreatedAt"))
                    entry.Property("CreatedAt").CurrentValue = now;
            }
            if (entry.State == EntityState.Modified)
            {
                if (entry.Properties.Any(p => p.Metadata.Name == "UpdatedAt"))
                    entry.Property("UpdatedAt").CurrentValue = now;
            }
        }
        return await base.SaveChangesAsync(cancellationToken);
    }
}
