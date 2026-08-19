using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Infrastructure.Persistence;
using Softaxis.Finance.Domain.Entities;

namespace Softaxis.Finance.Infrastructure.Persistence;

public sealed class FinanceDbContext(DbContextOptions<FinanceDbContext> options)
    : DbContext(options), ITenantAmbientContext
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
        TenantIsolation.ApplyTenantId(modelBuilder, this, "Softaxis.Finance.Domain",
            exclude: [typeof(Currency), typeof(ExchangeRate)]);

        // Account numbers and account-type codes are unique PER TENANT, not globally. These were
        // originally single-column unique indexes, which made it impossible for a second tenant to
        // own the standard chart of accounts at all (inserting its own '1001' hit a duplicate key).
        // Declared here rather than in the entity configurations because the shadow TenantId
        // property only exists after ApplyTenantId has run. Filtered to non-NULL so the legacy
        // global rows (TenantId IS NULL) are exempt. Mirrors the roles Name -> (TenantId, Name) fix.
        modelBuilder.Entity<Account>()
            .HasIndex(TenantIsolation.Column, nameof(Account.AccountNumber))
            .IsUnique()
            .HasFilter($"[{TenantIsolation.Column}] IS NOT NULL");
        modelBuilder.Entity<AccountType>()
            .HasIndex(TenantIsolation.Column, nameof(AccountType.Code))
            .IsUnique()
            .HasFilter($"[{TenantIsolation.Column}] IS NOT NULL");

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
