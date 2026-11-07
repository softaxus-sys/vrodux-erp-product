using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.Finance.Domain.Entities;

namespace Softaxis.Finance.Infrastructure.Persistence.Configurations;

// Tenant-scoped unique indexes for these are declared in FinanceDbContext, after the tenant column exists.

internal sealed class CreditNoteConfiguration : IEntityTypeConfiguration<CreditNote>
{
    public void Configure(EntityTypeBuilder<CreditNote> builder)
    {
        builder.ToTable("credit_notes");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.CreditNoteNumber).IsRequired().HasMaxLength(50);
        builder.Property(x => x.InvoiceNumber).IsRequired().HasMaxLength(50);
        builder.Property(x => x.CustomerName).IsRequired().HasMaxLength(200);
        builder.Property(x => x.CustomerEmail).HasMaxLength(200);
        builder.Property(x => x.CustomerAddress).HasMaxLength(1000);
        builder.Property(x => x.CustomerTrn).HasMaxLength(50);
        builder.Property(x => x.CreditDate).IsRequired().HasMaxLength(20);
        builder.Property(x => x.TaxRate).HasPrecision(5, 2);
        builder.Property(x => x.CurrencyCode).IsRequired().HasMaxLength(3);
        builder.Property(x => x.Reason).IsRequired().HasMaxLength(500);
        builder.Property(x => x.Notes).HasMaxLength(1000);
        builder.Property(x => x.Status).IsRequired().HasMaxLength(20);
        builder.Property(x => x.IsDeleted).HasDefaultValue(false);

        builder.Ignore(x => x.SubTotal);
        builder.Ignore(x => x.TaxableAmount);
        builder.Ignore(x => x.TaxAmount);
        builder.Ignore(x => x.Total);

        builder.HasIndex(x => x.InvoiceId);
        builder.HasMany(x => x.Items).WithOne(x => x.CreditNote).HasForeignKey(x => x.CreditNoteId).OnDelete(DeleteBehavior.Cascade);
        builder.HasOne<Invoice>().WithMany().HasForeignKey(x => x.InvoiceId).OnDelete(DeleteBehavior.Restrict);
    }
}

internal sealed class CreditNoteItemConfiguration : IEntityTypeConfiguration<CreditNoteItem>
{
    public void Configure(EntityTypeBuilder<CreditNoteItem> builder)
    {
        builder.ToTable("credit_note_items");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.Description).IsRequired().HasMaxLength(300);
        builder.Property(x => x.Quantity).HasPrecision(18, 4);
        builder.Property(x => x.UnitPrice).HasPrecision(18, 2);
        builder.Property(x => x.TaxCategory).HasMaxLength(2);
        builder.Property(x => x.UnitCode).HasMaxLength(10);
        builder.Property(x => x.ExemptionReason).HasMaxLength(300);
        builder.Ignore(x => x.LineTotal);
        builder.HasIndex(x => x.CreditNoteId);
    }
}

internal sealed class EInvoiceSettingsConfiguration : IEntityTypeConfiguration<EInvoiceSettings>
{
    public void Configure(EntityTypeBuilder<EInvoiceSettings> builder)
    {
        builder.ToTable("einvoice_settings");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.ProviderKey).IsRequired().HasMaxLength(40);
        builder.Property(x => x.Environment).IsRequired().HasMaxLength(12);
        builder.Property(x => x.GoLiveDate).HasMaxLength(10);
        builder.Property(x => x.LegalIdScheme).HasMaxLength(10);
        builder.Property(x => x.LegalId).HasMaxLength(60);
        builder.Property(x => x.RegistrationAuthority).HasMaxLength(120);
        builder.Property(x => x.SupplierCity).HasMaxLength(100);
    }
}

internal sealed class EInvoiceSubmissionConfiguration : IEntityTypeConfiguration<EInvoiceSubmission>
{
    public void Configure(EntityTypeBuilder<EInvoiceSubmission> builder)
    {
        builder.ToTable("einvoice_submissions");
        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).ValueGeneratedNever();
        builder.Property(x => x.DocumentType).IsRequired().HasMaxLength(20);
        builder.Property(x => x.DocumentNumber).IsRequired().HasMaxLength(60);
        builder.Property(x => x.ProviderKey).IsRequired().HasMaxLength(40);
        builder.Property(x => x.Status).IsRequired().HasMaxLength(20);
        builder.Property(x => x.ExternalId).HasMaxLength(200);
        builder.Property(x => x.LastError).HasMaxLength(1500);
        builder.Property(x => x.PayloadHash).HasMaxLength(80);
        builder.HasIndex(x => new { x.Status, x.NextAttemptAt });
    }
}
