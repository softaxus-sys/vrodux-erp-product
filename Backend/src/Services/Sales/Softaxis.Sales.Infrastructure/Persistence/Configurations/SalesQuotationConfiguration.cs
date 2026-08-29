using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.Sales.Domain.Entities;

namespace Softaxis.Sales.Infrastructure.Persistence.Configurations;

internal sealed class SalesQuotationConfiguration : IEntityTypeConfiguration<SalesQuotation>
{
    public void Configure(EntityTypeBuilder<SalesQuotation> builder)
    {
        builder.ToTable("sales_quotations");

        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).ValueGeneratedNever();

        builder.Property(x => x.QuotationNumber).IsRequired().HasMaxLength(50);
        builder.Property(x => x.Status).IsRequired().HasMaxLength(30).HasDefaultValue("draft");
        builder.Property(x => x.CurrencyCode).IsRequired().HasMaxLength(3);

        builder.Property(x => x.CustomerName).HasMaxLength(200);
        builder.Property(x => x.CustomerEmail).HasMaxLength(320);
        builder.Property(x => x.CustomerPhone).HasMaxLength(50);
        builder.Property(x => x.CustomerAddress).HasMaxLength(500);

        builder.Property(x => x.Title).HasMaxLength(200);
        builder.Property(x => x.Reference).HasMaxLength(100);
        builder.Property(x => x.IssueDate).HasMaxLength(20);
        builder.Property(x => x.ValidUntil).HasMaxLength(20);
        builder.Property(x => x.CoverNote).HasMaxLength(4000);
        builder.Property(x => x.TermsAndConditions).HasMaxLength(8000);
        builder.Property(x => x.PaymentTerms).HasMaxLength(1000);
        builder.Property(x => x.Notes).HasMaxLength(1000);
        builder.Property(x => x.PreparedByName).HasMaxLength(200);
        builder.Property(x => x.DiscountPercent).HasPrecision(5, 2);

        builder.Property(x => x.ShareToken).HasMaxLength(64);
        builder.Property(x => x.SentTo).HasMaxLength(320);
        builder.Property(x => x.RespondedByName).HasMaxLength(200);
        builder.Property(x => x.ResponseComment).HasMaxLength(2000);
        builder.Property(x => x.InvoiceNumber).HasMaxLength(50);

        // Free-form document fields as JSON. The ValueComparer is mandatory: without it EF
        // compares dictionaries by reference, never sees an in-place edit, and a save silently
        // does nothing (the same trap documented for BillingSettings in Module 22).
        builder.Property(x => x.CustomFields)
               .HasConversion(
                   v => v == null || v.Count == 0 ? null : JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
                   v => string.IsNullOrWhiteSpace(v)
                        ? null
                        : JsonSerializer.Deserialize<Dictionary<string, string>>(v, (JsonSerializerOptions?)null))
               .Metadata.SetValueComparer(new ValueComparer<Dictionary<string, string>?>(
                   (a, b) => a == null ? b == null
                             : b != null && a.Count == b.Count && !a.Except(b).Any(),
                   d => d == null ? 0 : d.Aggregate(0, (h, kv) => HashCode.Combine(h, kv.Key.GetHashCode(), kv.Value.GetHashCode())),
                   d => d == null ? null : new Dictionary<string, string>(d)));

        builder.Property(x => x.CreatedAt).IsRequired();
        builder.Property(x => x.IsDeleted).IsRequired().HasDefaultValue(false);

        builder.HasQueryFilter(x => !x.IsDeleted);

        // Unique per tenant, live rows only — declared in SalesDbContext (needs the TenantId shadow column).
        builder.HasIndex(x => x.Status);
        // The public link resolves a quotation by token alone, with no tenant context on the
        // request, so this lookup must be indexed and unique across the whole table.
        builder.HasIndex(x => x.ShareToken).IsUnique().HasFilter("[ShareToken] IS NOT NULL");
        builder.HasIndex(x => x.InvoiceId);

        builder.HasOne(x => x.Customer)
               .WithMany(x => x.SalesQuotations)
               .HasForeignKey(x => x.CustomerId)
               .OnDelete(DeleteBehavior.SetNull);

        builder.HasMany(x => x.Items)
               .WithOne(x => x.Quotation)
               .HasForeignKey(x => x.QuotationId)
               .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(x => x.Sections)
               .WithOne(x => x.Quotation)
               .HasForeignKey(x => x.QuotationId)
               .OnDelete(DeleteBehavior.Cascade);

        builder.Ignore(x => x.SubTotal);
        builder.Ignore(x => x.DiscountAmount);
        builder.Ignore(x => x.NetSubTotal);
        builder.Ignore(x => x.TaxAmount);
        builder.Ignore(x => x.Total);
        builder.Ignore(x => x.OptionalTotal);
    }
}

internal sealed class SalesQuotationSectionConfiguration : IEntityTypeConfiguration<SalesQuotationSection>
{
    public void Configure(EntityTypeBuilder<SalesQuotationSection> builder)
    {
        builder.ToTable("sales_quotation_sections");

        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).ValueGeneratedNever();

        builder.Property(x => x.Title).IsRequired().HasMaxLength(200);
        builder.Property(x => x.Description).HasMaxLength(1000);

        builder.HasIndex(x => x.QuotationId);
    }
}

internal sealed class SalesQuotationItemConfiguration : IEntityTypeConfiguration<SalesQuotationItem>
{
    public void Configure(EntityTypeBuilder<SalesQuotationItem> builder)
    {
        builder.ToTable("sales_quotation_items");

        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).ValueGeneratedNever();

        builder.Property(x => x.Description).IsRequired().HasMaxLength(300);
        builder.Property(x => x.Unit).HasMaxLength(30);
        builder.Property(x => x.Notes).HasMaxLength(500);
        builder.Property(x => x.Quantity).HasPrecision(18, 4);
        builder.Property(x => x.UnitPrice).HasPrecision(18, 2);
        builder.Property(x => x.DiscountPercent).HasPrecision(5, 2);
        builder.Property(x => x.TaxRate).HasPrecision(5, 2);
        builder.Property(x => x.IsOptional).IsRequired().HasDefaultValue(false);

        // Scalar reference, no FK: a section can be removed while its lines are re-homed in the
        // same save, and a constraint would make that ordering-sensitive for no benefit.
        builder.HasIndex(x => x.SectionId);

        builder.Ignore(x => x.LineTotal);
    }
}
