using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.Finance.Domain.Entities;

namespace Softaxis.Finance.Infrastructure.Persistence.Configurations;

internal sealed class RecurringInvoiceConfiguration : IEntityTypeConfiguration<RecurringInvoice>
{
    public void Configure(EntityTypeBuilder<RecurringInvoice> b)
    {
        b.ToTable("recurring_invoices");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).ValueGeneratedNever();

        b.Property(x => x.TemplateName).IsRequired().HasMaxLength(150);
        b.Property(x => x.CustomerName).IsRequired().HasMaxLength(200);
        b.Property(x => x.CustomerEmail).HasMaxLength(200);
        b.Property(x => x.Frequency).IsRequired().HasMaxLength(20);
        b.Property(x => x.TaxRate).HasPrecision(9, 4);
        b.Property(x => x.Notes).HasMaxLength(1000);
        b.Property(x => x.CcEmails).HasMaxLength(2000);
        b.Property(x => x.AutoSend).HasDefaultValue(true);
        b.Ignore(x => x.CcList);

        b.HasQueryFilter(x => !x.IsDeleted);
        b.HasIndex(x => new { x.IsActive, x.NextRunDate });

        b.HasMany(x => x.Lines)
         .WithOne(l => l.RecurringInvoice!)
         .HasForeignKey(l => l.RecurringInvoiceId)
         .OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class RecurringInvoiceLineConfiguration : IEntityTypeConfiguration<RecurringInvoiceLine>
{
    public void Configure(EntityTypeBuilder<RecurringInvoiceLine> b)
    {
        b.ToTable("recurring_invoice_lines");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).ValueGeneratedNever();
        b.Property(x => x.Description).IsRequired().HasMaxLength(500);
        b.Property(x => x.Quantity).HasPrecision(18, 4);
        b.Property(x => x.UnitPrice).HasPrecision(18, 2);
    }
}
