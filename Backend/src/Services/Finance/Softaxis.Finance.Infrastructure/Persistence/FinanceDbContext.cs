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

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("finance");
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(FinanceDbContext).Assembly);
        TenantIsolation.ApplyTenantId(modelBuilder, "Softaxis.Finance.Domain");
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
