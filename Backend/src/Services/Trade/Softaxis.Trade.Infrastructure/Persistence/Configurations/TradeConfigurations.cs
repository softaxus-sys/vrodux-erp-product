using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.Trade.Domain.Entities;

namespace Softaxis.Trade.Infrastructure.Persistence.Configurations;

internal sealed class TradePartyConfiguration : IEntityTypeConfiguration<TradeParty>
{
    public void Configure(EntityTypeBuilder<TradeParty> b)
    {
        b.ToTable("parties");
        b.HasKey(x => x.Id); b.Property(x => x.Id).ValueGeneratedNever();
        b.Property(x => x.Kind).IsRequired().HasMaxLength(30);
        b.Property(x => x.Name).IsRequired().HasMaxLength(200);
        b.Property(x => x.Country).HasMaxLength(100);
        b.Property(x => x.ContactName).HasMaxLength(200);
        b.Property(x => x.Email).HasMaxLength(320);
        b.Property(x => x.Phone).HasMaxLength(50);
        b.Property(x => x.Address).HasMaxLength(500);
        b.Property(x => x.TaxNumber).HasMaxLength(60);
        b.Property(x => x.Notes).HasMaxLength(2000);
        b.Property(x => x.IsDeleted).HasDefaultValue(false);
        b.HasIndex(x => x.Kind);
    }
}

internal sealed class ShipmentConfiguration : IEntityTypeConfiguration<Shipment>
{
    public void Configure(EntityTypeBuilder<Shipment> b)
    {
        b.ToTable("shipments");
        b.HasKey(x => x.Id); b.Property(x => x.Id).ValueGeneratedNever();
        b.Property(x => x.ShipmentNumber).IsRequired().HasMaxLength(30);
        b.Property(x => x.Direction).IsRequired().HasMaxLength(10);
        b.Property(x => x.Status).IsRequired().HasMaxLength(20);
        b.Property(x => x.Mode).IsRequired().HasMaxLength(10);
        b.Property(x => x.OrderReference).HasMaxLength(100);
        b.Property(x => x.LinkedOrderType).HasMaxLength(10);
        b.Property(x => x.Incoterm).HasMaxLength(5);
        b.Property(x => x.BlNumber).HasMaxLength(100);
        b.Property(x => x.CarrierName).HasMaxLength(200);
        b.Property(x => x.VesselOrFlight).HasMaxLength(200);
        b.Property(x => x.OriginCountry).HasMaxLength(100);
        b.Property(x => x.OriginPort).HasMaxLength(150);
        b.Property(x => x.DestinationCountry).HasMaxLength(100);
        b.Property(x => x.DestinationPort).HasMaxLength(150);
        b.Property(x => x.Currency).IsRequired().HasMaxLength(3);
        b.Property(x => x.ExchangeRate).HasPrecision(18, 6);
        b.Property(x => x.Notes).HasMaxLength(4000);
        b.Property(x => x.IsDeleted).HasDefaultValue(false);
        b.Ignore(x => x.GoodsValue);
        b.Ignore(x => x.FreeTimeEnds);

        b.HasIndex(x => x.Status);
        b.HasIndex(x => x.PartnerId);
        b.HasIndex(x => x.Eta);

        b.HasMany(x => x.Items).WithOne().HasForeignKey(i => i.ShipmentId).OnDelete(DeleteBehavior.Cascade);
        b.HasMany(x => x.Containers).WithOne().HasForeignKey(c => c.ShipmentId).OnDelete(DeleteBehavior.Cascade);
        b.HasMany(x => x.Milestones).WithOne().HasForeignKey(m => m.ShipmentId).OnDelete(DeleteBehavior.Cascade);
        b.HasMany(x => x.Costs).WithOne().HasForeignKey(c => c.ShipmentId).OnDelete(DeleteBehavior.Cascade);
        b.HasMany(x => x.Payments).WithOne().HasForeignKey(p => p.ShipmentId).OnDelete(DeleteBehavior.Cascade);
    }
}

internal sealed class ShipmentItemConfiguration : IEntityTypeConfiguration<ShipmentItem>
{
    public void Configure(EntityTypeBuilder<ShipmentItem> b)
    {
        b.ToTable("shipment_items");
        b.HasKey(x => x.Id); b.Property(x => x.Id).ValueGeneratedNever();
        b.Property(x => x.Description).IsRequired().HasMaxLength(400);
        b.Property(x => x.HsCode).HasMaxLength(20);
        b.Property(x => x.OriginCountry).HasMaxLength(100);
        b.Property(x => x.Quantity).HasPrecision(18, 4);
        b.Property(x => x.Unit).IsRequired().HasMaxLength(20);
        b.Property(x => x.UnitPrice).HasPrecision(18, 4);
        b.Property(x => x.WeightKg).HasPrecision(18, 3);
        b.Property(x => x.VolumeCbm).HasPrecision(18, 3);
        b.Property(x => x.Sku).HasMaxLength(60);
        b.Ignore(x => x.LineValue);
        b.HasIndex(x => x.ShipmentId);
    }
}

internal sealed class ShipmentContainerConfiguration : IEntityTypeConfiguration<ShipmentContainer>
{
    public void Configure(EntityTypeBuilder<ShipmentContainer> b)
    {
        b.ToTable("shipment_containers");
        b.HasKey(x => x.Id); b.Property(x => x.Id).ValueGeneratedNever();
        b.Property(x => x.Number).IsRequired().HasMaxLength(30);
        b.Property(x => x.Type).HasMaxLength(20);
        b.Property(x => x.SealNumber).HasMaxLength(40);
        b.Property(x => x.GrossWeightKg).HasPrecision(18, 3);
        b.HasIndex(x => x.ShipmentId);
    }
}

internal sealed class ShipmentMilestoneConfiguration : IEntityTypeConfiguration<ShipmentMilestone>
{
    public void Configure(EntityTypeBuilder<ShipmentMilestone> b)
    {
        b.ToTable("shipment_milestones");
        b.HasKey(x => x.Id); b.Property(x => x.Id).ValueGeneratedNever();
        b.Property(x => x.Status).IsRequired().HasMaxLength(20);
        b.Property(x => x.Note).HasMaxLength(500);
        b.Property(x => x.RecordedBy).HasMaxLength(200);
        b.HasIndex(x => x.ShipmentId);
    }
}

internal sealed class ShipmentCostConfiguration : IEntityTypeConfiguration<ShipmentCost>
{
    public void Configure(EntityTypeBuilder<ShipmentCost> b)
    {
        b.ToTable("shipment_costs");
        b.HasKey(x => x.Id); b.Property(x => x.Id).ValueGeneratedNever();
        b.Property(x => x.Type).IsRequired().HasMaxLength(30);
        b.Property(x => x.Description).HasMaxLength(300);
        b.Property(x => x.Amount).HasPrecision(18, 2);
        b.Property(x => x.Basis).IsRequired().HasMaxLength(20);
        b.Property(x => x.VendorName).HasMaxLength(200);
        b.Property(x => x.InvoiceReference).HasMaxLength(100);
        b.HasIndex(x => x.ShipmentId);
    }
}

internal sealed class ShipmentPaymentConfiguration : IEntityTypeConfiguration<ShipmentPayment>
{
    public void Configure(EntityTypeBuilder<ShipmentPayment> b)
    {
        b.ToTable("shipment_payments");
        b.HasKey(x => x.Id); b.Property(x => x.Id).ValueGeneratedNever();
        b.Property(x => x.Kind).IsRequired().HasMaxLength(20);
        b.Property(x => x.Amount).HasPrecision(18, 2);
        b.Property(x => x.Status).IsRequired().HasMaxLength(20);
        b.Property(x => x.Reference).HasMaxLength(100);
        b.Property(x => x.LcNumber).HasMaxLength(60);
        b.Property(x => x.BankName).HasMaxLength(200);
        b.Property(x => x.Notes).HasMaxLength(1000);
        b.HasIndex(x => x.ShipmentId);
        b.HasIndex(x => x.DueDate);
    }
}

internal sealed class TradeDocumentConfiguration : IEntityTypeConfiguration<TradeDocument>
{
    public void Configure(EntityTypeBuilder<TradeDocument> b)
    {
        b.ToTable("documents");
        b.HasKey(x => x.Id); b.Property(x => x.Id).ValueGeneratedNever();
        b.Property(x => x.Type).IsRequired().HasMaxLength(30);
        b.Property(x => x.Number).HasMaxLength(100);
        b.Property(x => x.Notes).HasMaxLength(1000);
        b.Property(x => x.FileName).HasMaxLength(260);
        b.Property(x => x.ContentType).HasMaxLength(150);
        b.Property(x => x.Content).HasColumnType("varbinary(max)");
        b.Property(x => x.IsDeleted).HasDefaultValue(false);
        b.HasIndex(x => x.ShipmentId);
        b.HasIndex(x => x.ExpiryDate);
    }
}

internal sealed class TradeAlertStateConfiguration : IEntityTypeConfiguration<TradeAlertState>
{
    public void Configure(EntityTypeBuilder<TradeAlertState> b)
    {
        b.ToTable("alert_states");
        b.HasKey(x => x.Id); b.Property(x => x.Id).ValueGeneratedNever();
        b.Property(x => x.LastDigestDate).IsRequired().HasMaxLength(10);
    }
}

internal sealed class HsDutyRateConfiguration : IEntityTypeConfiguration<HsDutyRate>
{
    public void Configure(EntityTypeBuilder<HsDutyRate> b)
    {
        b.ToTable("duty_rates");
        b.HasKey(x => x.Id); b.Property(x => x.Id).ValueGeneratedNever();
        b.Property(x => x.HsCode).IsRequired().HasMaxLength(20);
        b.Property(x => x.HsDigits).IsRequired().HasMaxLength(12);
        b.Property(x => x.Description).HasMaxLength(300);
        b.Property(x => x.DutyPercent).HasPrecision(9, 4);
        b.Property(x => x.Notes).HasMaxLength(1000);
        b.Property(x => x.IsDeleted).HasDefaultValue(false);
    }
}
