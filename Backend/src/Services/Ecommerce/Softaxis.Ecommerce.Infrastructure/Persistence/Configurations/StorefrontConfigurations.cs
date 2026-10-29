using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.Ecommerce.Domain.Entities;

namespace Softaxis.Ecommerce.Infrastructure.Persistence.Configurations;

public sealed class StoreConfiguration : IEntityTypeConfiguration<Store>
{
    public void Configure(EntityTypeBuilder<Store> b)
    {
        b.ToTable("stores");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).ValueGeneratedNever();   // ids are made in code; without this EF treats a child added to a loaded order as already existing
        b.Property(x => x.Name).HasMaxLength(150).IsRequired();
        b.Property(x => x.Slug).HasMaxLength(63).IsRequired();
        b.Property(x => x.CustomDomain).HasMaxLength(253);
        b.Property(x => x.CurrencyCode).HasMaxLength(10).IsRequired();
        b.Property(x => x.Language).HasMaxLength(5).IsRequired();
        b.Property(x => x.ContactEmail).HasMaxLength(320);
        b.Property(x => x.ContactPhone).HasMaxLength(40);
        b.Property(x => x.Address).HasMaxLength(500);
        b.Property(x => x.OrderNotifyEmail).HasMaxLength(320);
        b.Property(x => x.AnnouncementText).HasMaxLength(300);
        b.Property(x => x.SeoTitle).HasMaxLength(120);
        b.Property(x => x.MetaDescription).HasMaxLength(320);
        b.Property(x => x.ThemeJson).IsRequired();
        b.Property(x => x.HeaderMenuJson).IsRequired();
        b.Property(x => x.FooterMenuJson).IsRequired();
        b.Property(x => x.SocialJson).IsRequired();
        b.Property(x => x.TaxPercent).HasPrecision(5, 2);
        b.Property(x => x.CodInstructions).HasMaxLength(1000);
        b.Property(x => x.BankDetails).HasMaxLength(2000);
        b.Property(x => x.StripeSecretEnc).HasMaxLength(2000);
        b.Property(x => x.StripeWebhookSecretEnc).HasMaxLength(2000);
        b.Property(x => x.PayPalClientId).HasMaxLength(200);
        b.Property(x => x.PayPalSecretEnc).HasMaxLength(2000);

        // Platform-wide, not per workspace: a visitor arrives knowing only the address.
        b.HasIndex(x => x.Slug).IsUnique();
        b.HasIndex(x => x.CustomDomain).IsUnique().HasFilter("[CustomDomain] IS NOT NULL");
    }
}

public sealed class StorePageConfiguration : IEntityTypeConfiguration<StorePage>
{
    public void Configure(EntityTypeBuilder<StorePage> b)
    {
        b.ToTable("store_pages");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).ValueGeneratedNever();   // ids are made in code; without this EF treats a child added to a loaded order as already existing
        b.Property(x => x.Slug).HasMaxLength(100).IsRequired();
        b.Property(x => x.Title).HasMaxLength(200).IsRequired();
        b.Property(x => x.Kind).HasMaxLength(10).IsRequired();
        b.Property(x => x.SectionsJson).IsRequired();
        b.Property(x => x.SeoTitle).HasMaxLength(120);
        b.Property(x => x.MetaDescription).HasMaxLength(320);
    }
}

public sealed class StoreAssetConfiguration : IEntityTypeConfiguration<StoreAsset>
{
    public void Configure(EntityTypeBuilder<StoreAsset> b)
    {
        b.ToTable("store_assets");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).ValueGeneratedNever();   // ids are made in code; without this EF treats a child added to a loaded order as already existing
        b.Property(x => x.FileName).HasMaxLength(255).IsRequired();
        b.Property(x => x.ContentType).HasMaxLength(100).IsRequired();
        b.Property(x => x.Data).IsRequired();
    }
}

public sealed class StoreCollectionConfiguration : IEntityTypeConfiguration<StoreCollection>
{
    public void Configure(EntityTypeBuilder<StoreCollection> b)
    {
        b.ToTable("store_collections");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).ValueGeneratedNever();   // ids are made in code; without this EF treats a child added to a loaded order as already existing
        b.Property(x => x.Slug).HasMaxLength(100).IsRequired();
        b.Property(x => x.Name).HasMaxLength(150).IsRequired();
        b.Property(x => x.Description).HasMaxLength(2000);
        b.Property(x => x.TemplateIdsJson).IsRequired();
        b.Property(x => x.CategoryName).HasMaxLength(150);
    }
}

public sealed class ShippingZoneConfiguration : IEntityTypeConfiguration<ShippingZone>
{
    public void Configure(EntityTypeBuilder<ShippingZone> b)
    {
        b.ToTable("shipping_zones");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).ValueGeneratedNever();   // ids are made in code; without this EF treats a child added to a loaded order as already existing
        b.Property(x => x.Name).HasMaxLength(150).IsRequired();
        b.Property(x => x.CountriesJson).IsRequired();
        b.Property(x => x.FlatRate).HasPrecision(18, 2);
        b.Property(x => x.FreeOver).HasPrecision(18, 2);
        b.Property(x => x.MinOrder).HasPrecision(18, 2);
        b.Property(x => x.EstimatedDays).HasMaxLength(60);
    }
}

public sealed class DiscountCodeConfiguration : IEntityTypeConfiguration<DiscountCode>
{
    public void Configure(EntityTypeBuilder<DiscountCode> b)
    {
        b.ToTable("discount_codes");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).ValueGeneratedNever();   // ids are made in code; without this EF treats a child added to a loaded order as already existing
        b.Property(x => x.Code).HasMaxLength(40).IsRequired();
        b.Property(x => x.Kind).HasMaxLength(20).IsRequired();
        b.Property(x => x.Value).HasPrecision(18, 2);
        b.Property(x => x.MinSubtotal).HasPrecision(18, 2);
    }
}

public sealed class StoreCustomerConfiguration : IEntityTypeConfiguration<StoreCustomer>
{
    public void Configure(EntityTypeBuilder<StoreCustomer> b)
    {
        b.ToTable("store_customers");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).ValueGeneratedNever();   // ids are made in code; without this EF treats a child added to a loaded order as already existing
        b.Ignore(x => x.FullName);
        b.Property(x => x.Email).HasMaxLength(320).IsRequired();
        b.Property(x => x.PasswordHash).HasMaxLength(300).IsRequired();
        b.Property(x => x.FirstName).HasMaxLength(100).IsRequired();
        b.Property(x => x.LastName).HasMaxLength(100).IsRequired();
        b.Property(x => x.Phone).HasMaxLength(40);
        b.Property(x => x.ResetTokenHash).HasMaxLength(100);
    }
}

public sealed class StoreCustomerAddressConfiguration : IEntityTypeConfiguration<StoreCustomerAddress>
{
    public void Configure(EntityTypeBuilder<StoreCustomerAddress> b)
    {
        b.ToTable("store_customer_addresses");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).ValueGeneratedNever();   // ids are made in code; without this EF treats a child added to a loaded order as already existing
        b.Property(x => x.Name).HasMaxLength(150).IsRequired();
        b.Property(x => x.Phone).HasMaxLength(40);
        b.Property(x => x.Line1).HasMaxLength(250).IsRequired();
        b.Property(x => x.Line2).HasMaxLength(250);
        b.Property(x => x.City).HasMaxLength(100).IsRequired();
        b.Property(x => x.Region).HasMaxLength(100);
        b.Property(x => x.PostalCode).HasMaxLength(20);
        b.Property(x => x.Country).HasMaxLength(2).IsRequired();
        b.HasIndex(x => x.CustomerId);
    }
}

public sealed class StoreOrderConfiguration : IEntityTypeConfiguration<StoreOrder>
{
    public void Configure(EntityTypeBuilder<StoreOrder> b)
    {
        b.ToTable("store_orders");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).ValueGeneratedNever();   // ids are made in code; without this EF treats a child added to a loaded order as already existing
        b.Ignore(x => x.IsOpen);
        b.Property(x => x.Number).HasMaxLength(20).IsRequired();
        b.Property(x => x.AccessToken).HasMaxLength(64).IsRequired();
        b.Property(x => x.Email).HasMaxLength(320).IsRequired();
        b.Property(x => x.Phone).HasMaxLength(40);
        b.Property(x => x.CustomerName).HasMaxLength(200).IsRequired();
        b.Property(x => x.ShipName).HasMaxLength(200).IsRequired();
        b.Property(x => x.ShipLine1).HasMaxLength(250).IsRequired();
        b.Property(x => x.ShipLine2).HasMaxLength(250);
        b.Property(x => x.ShipCity).HasMaxLength(100).IsRequired();
        b.Property(x => x.ShipRegion).HasMaxLength(100);
        b.Property(x => x.ShipPostal).HasMaxLength(20);
        b.Property(x => x.ShipCountry).HasMaxLength(2).IsRequired();
        b.Property(x => x.ShippingMethod).HasMaxLength(150);
        b.Property(x => x.Subtotal).HasPrecision(18, 2);
        b.Property(x => x.DiscountTotal).HasPrecision(18, 2);
        b.Property(x => x.DiscountCode).HasMaxLength(40);
        b.Property(x => x.ShippingTotal).HasPrecision(18, 2);
        b.Property(x => x.TaxTotal).HasPrecision(18, 2);
        b.Property(x => x.Total).HasPrecision(18, 2);
        b.Property(x => x.CurrencyCode).HasMaxLength(10).IsRequired();
        b.Property(x => x.PaymentMethod).HasMaxLength(20).IsRequired();
        b.Property(x => x.PaymentStatus).HasMaxLength(20).IsRequired();
        b.Property(x => x.Status).HasMaxLength(20).IsRequired();
        b.Property(x => x.StripeSessionId).HasMaxLength(200);
        b.Property(x => x.PayPalOrderId).HasMaxLength(100);
        b.Property(x => x.PaymentReference).HasMaxLength(200);
        b.Property(x => x.TrackingCarrier).HasMaxLength(100);
        b.Property(x => x.TrackingNumber).HasMaxLength(100);
        b.Property(x => x.TrackingUrl).HasMaxLength(500);
        b.Property(x => x.CancelReason).HasMaxLength(500);
        b.Property(x => x.CustomerNote).HasMaxLength(1000);
        b.Property(x => x.StaffNote).HasMaxLength(2000);
        b.HasIndex(x => x.CustomerId);
        b.HasIndex(x => x.Status);
        b.HasMany(x => x.Lines).WithOne().HasForeignKey(l => l.OrderId).OnDelete(DeleteBehavior.Cascade);
        b.HasMany(x => x.Events).WithOne().HasForeignKey(e => e.OrderId).OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class StoreOrderLineConfiguration : IEntityTypeConfiguration<StoreOrderLine>
{
    public void Configure(EntityTypeBuilder<StoreOrderLine> b)
    {
        b.ToTable("store_order_lines");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).ValueGeneratedNever();   // ids are made in code; without this EF treats a child added to a loaded order as already existing
        b.Ignore(x => x.LineTotal);
        b.Property(x => x.Title).HasMaxLength(250).IsRequired();
        b.Property(x => x.VariantName).HasMaxLength(250);
        b.Property(x => x.Sku).HasMaxLength(100);
        b.Property(x => x.UnitPrice).HasPrecision(18, 2);
    }
}

public sealed class StoreOrderEventConfiguration : IEntityTypeConfiguration<StoreOrderEvent>
{
    public void Configure(EntityTypeBuilder<StoreOrderEvent> b)
    {
        b.ToTable("store_order_events");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).ValueGeneratedNever();   // ids are made in code; without this EF treats a child added to a loaded order as already existing
        b.Property(x => x.Kind).HasMaxLength(30).IsRequired();
        b.Property(x => x.Message).HasMaxLength(500).IsRequired();
        b.Property(x => x.ByName).HasMaxLength(200);
    }
}
