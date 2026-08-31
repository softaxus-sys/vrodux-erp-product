using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.Finance.Domain.Entities;

namespace Softaxis.Finance.Infrastructure.Persistence.Configurations;

internal sealed class InvoiceConfiguration : IEntityTypeConfiguration<Invoice>
{
    public void Configure(EntityTypeBuilder<Invoice> builder)
    {
        builder.ToTable("invoices");

        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).ValueGeneratedNever();

        builder.Property(x => x.InvoiceNumber).IsRequired().HasMaxLength(50);
        builder.Property(x => x.CustomerName).IsRequired().HasMaxLength(200);
        builder.Property(x => x.CustomerEmail).HasMaxLength(200);
        builder.Property(x => x.InvoiceDate).IsRequired().HasMaxLength(20);
        builder.Property(x => x.DueDate).IsRequired().HasMaxLength(20);
        builder.Property(x => x.TaxRate).HasPrecision(5, 2);
        builder.Property(x => x.CurrencyCode).IsRequired().HasMaxLength(3).HasDefaultValue("AED");
        builder.Property(x => x.EmailSentTo).HasMaxLength(320);
        builder.Property(x => x.EmailCc).HasMaxLength(2000);
        builder.Property(x => x.Status).IsRequired().HasMaxLength(20).HasDefaultValue("draft");
        builder.Property(x => x.Notes).HasMaxLength(1000);
        builder.Property(x => x.AmountPaid).HasPrecision(18, 2);
        builder.Property(x => x.CreatedAt).IsRequired();
        builder.Property(x => x.IsDeleted).IsRequired().HasDefaultValue(false);

        // Computed — not mapped
        builder.Ignore(x => x.SubTotal);
        builder.Ignore(x => x.TaxAmount);
        builder.Ignore(x => x.Total);
        builder.Ignore(x => x.AmountDue);

        builder.HasQueryFilter(x => !x.IsDeleted);

        // Unique per tenant, live rows only — declared in FinanceDbContext (needs the TenantId shadow column).
        builder.HasIndex(x => x.Status);
        builder.HasIndex(x => x.DueDate);

        builder.HasMany(x => x.Items)
               .WithOne(x => x.Invoice)
               .HasForeignKey(x => x.InvoiceId)
               .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne<Customer>()
               .WithMany()
               .HasForeignKey(x => x.CustomerId)
               .OnDelete(DeleteBehavior.Restrict);
    }
}

internal sealed class InvoiceItemConfiguration : IEntityTypeConfiguration<InvoiceItem>
{
    public void Configure(EntityTypeBuilder<InvoiceItem> builder)
    {
        builder.ToTable("invoice_items");

        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).ValueGeneratedNever();

        builder.Property(x => x.Description).IsRequired().HasMaxLength(300);
        builder.Property(x => x.Quantity).HasPrecision(18, 4);
        builder.Property(x => x.UnitPrice).HasPrecision(18, 2);

        builder.Ignore(x => x.LineTotal);

        builder.HasIndex(x => x.InvoiceId);
    }
}
