using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.Sales.Domain.Entities;

namespace Softaxis.Sales.Infrastructure.Persistence.Configurations;

internal sealed class QuotationTemplateConfiguration : IEntityTypeConfiguration<QuotationTemplate>
{
    public void Configure(EntityTypeBuilder<QuotationTemplate> builder)
    {
        builder.ToTable("quotation_templates");

        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).ValueGeneratedNever();

        builder.Property(x => x.Name).IsRequired().HasMaxLength(150);
        builder.Property(x => x.Description).HasMaxLength(500);
        builder.Property(x => x.TitleTemplate).HasMaxLength(200);
        builder.Property(x => x.CoverNote).HasMaxLength(4000);
        builder.Property(x => x.TermsAndConditions).HasMaxLength(8000);
        builder.Property(x => x.PaymentTerms).HasMaxLength(1000);
        builder.Property(x => x.FooterNote).HasMaxLength(1000);
        builder.Property(x => x.AccentColor).HasMaxLength(20);
        builder.Property(x => x.DefaultTaxRate).HasPrecision(5, 2);
        builder.Property(x => x.DefaultDiscount).HasPrecision(5, 2);
        builder.Property(x => x.IsDefault).IsRequired().HasDefaultValue(false);
        builder.Property(x => x.IsActive).IsRequired().HasDefaultValue(true);
        builder.Property(x => x.IsDeleted).IsRequired().HasDefaultValue(false);

        // Same ValueComparer requirement as the quotation's own CustomFields.
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

        builder.HasQueryFilter(x => !x.IsDeleted);

        builder.HasMany(x => x.Items)
               .WithOne(x => x.Template)
               .HasForeignKey(x => x.TemplateId)
               .OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class QuotationTemplateItemConfiguration : IEntityTypeConfiguration<QuotationTemplateItem>
{
    public void Configure(EntityTypeBuilder<QuotationTemplateItem> builder)
    {
        builder.ToTable("quotation_template_items");

        builder.HasKey(x => x.Id);
        builder.Property(x => x.Id).ValueGeneratedNever();

        builder.Property(x => x.Description).IsRequired().HasMaxLength(300);
        builder.Property(x => x.Unit).HasMaxLength(30);
        builder.Property(x => x.SectionTitle).HasMaxLength(200);
        builder.Property(x => x.Quantity).HasPrecision(18, 4);
        builder.Property(x => x.UnitPrice).HasPrecision(18, 2);
        builder.Property(x => x.DiscountPercent).HasPrecision(5, 2);
        builder.Property(x => x.TaxRate).HasPrecision(5, 2);
        builder.Property(x => x.IsOptional).IsRequired().HasDefaultValue(false);

        builder.HasIndex(x => x.TemplateId);
    }
}
