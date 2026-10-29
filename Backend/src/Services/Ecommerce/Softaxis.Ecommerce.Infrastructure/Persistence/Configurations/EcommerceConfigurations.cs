using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.Ecommerce.Domain.Entities;

namespace Softaxis.Ecommerce.Infrastructure.Persistence.Configurations;

public sealed class SalesChannelConfiguration : IEntityTypeConfiguration<SalesChannel>
{
    public void Configure(EntityTypeBuilder<SalesChannel> b)
    {
        b.ToTable("sales_channels");
        b.HasKey(x => x.Id);
        b.Property(x => x.Kind).HasMaxLength(30).IsRequired();
        b.Property(x => x.Name).HasMaxLength(150).IsRequired();
        b.Property(x => x.ShopDomain).HasMaxLength(200).IsRequired();
        b.Property(x => x.EncryptedToken).HasMaxLength(2000).IsRequired();
        b.Property(x => x.Status).HasMaxLength(20).IsRequired();
        b.Property(x => x.ExternalLocationId).HasMaxLength(60);
        b.Property(x => x.LocationName).HasMaxLength(200);
        b.Property(x => x.CurrencyCode).HasMaxLength(10);
        b.Property(x => x.LastError).HasMaxLength(1000);
    }
}

public sealed class ChannelListingConfiguration : IEntityTypeConfiguration<ChannelListing>
{
    public void Configure(EntityTypeBuilder<ChannelListing> b)
    {
        b.ToTable("channel_listings");
        b.HasKey(x => x.Id);
        b.Property(x => x.TemplateName).HasMaxLength(250).IsRequired();
        b.Property(x => x.ExternalProductId).HasMaxLength(60);
        b.Property(x => x.ExternalHandle).HasMaxLength(255);
        b.Property(x => x.Status).HasMaxLength(20).IsRequired();
        b.Property(x => x.ContentHash).HasMaxLength(80);
        b.Property(x => x.FailedHash).HasMaxLength(80);
        b.Property(x => x.ImagesHash).HasMaxLength(80);
        b.Property(x => x.LastError).HasMaxLength(1000);
        b.HasIndex(x => x.ChannelId);
        b.HasIndex(x => x.TemplateId);
        b.HasMany(x => x.Variants).WithOne().HasForeignKey(v => v.ListingId).OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class ChannelListingVariantConfiguration : IEntityTypeConfiguration<ChannelListingVariant>
{
    public void Configure(EntityTypeBuilder<ChannelListingVariant> b)
    {
        b.ToTable("channel_listing_variants");
        b.HasKey(x => x.Id);
        b.Property(x => x.ExternalVariantId).HasMaxLength(60).IsRequired();
        b.Property(x => x.ExternalInventoryItemId).HasMaxLength(60);
        b.Property(x => x.Sku).HasMaxLength(100);
        b.HasIndex(x => x.ProductId);
        b.HasIndex(x => x.ExternalVariantId);
    }
}

public sealed class ChannelOrderConfiguration : IEntityTypeConfiguration<ChannelOrder>
{
    public void Configure(EntityTypeBuilder<ChannelOrder> b)
    {
        b.ToTable("channel_orders");
        b.HasKey(x => x.Id);
        b.Property(x => x.ExternalId).HasMaxLength(60).IsRequired();
        b.Property(x => x.OrderNumber).HasMaxLength(60).IsRequired();
        b.Property(x => x.Status).HasMaxLength(20).IsRequired();
        b.Property(x => x.CustomerName).HasMaxLength(250);
        b.Property(x => x.Email).HasMaxLength(320);
        b.Property(x => x.FinancialStatus).HasMaxLength(40);
        b.Property(x => x.FulfillmentStatus).HasMaxLength(40);
        b.Property(x => x.CurrencyCode).HasMaxLength(10);
        b.Property(x => x.Note).HasMaxLength(500);
        b.Property(x => x.Total).HasPrecision(18, 2);
        b.HasIndex(x => x.ChannelId);
        b.HasIndex(x => x.PlacedAt);
        b.HasMany(x => x.Lines).WithOne().HasForeignKey(l => l.OrderId).OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class ChannelOrderLineConfiguration : IEntityTypeConfiguration<ChannelOrderLine>
{
    public void Configure(EntityTypeBuilder<ChannelOrderLine> b)
    {
        b.ToTable("channel_order_lines");
        b.HasKey(x => x.Id);
        b.Property(x => x.Title).HasMaxLength(500).IsRequired();
        b.Property(x => x.Sku).HasMaxLength(100);
        b.Property(x => x.ExternalVariantId).HasMaxLength(60);
        b.Property(x => x.Quantity).HasPrecision(18, 3);
        b.Property(x => x.UnitPrice).HasPrecision(18, 2);
    }
}
