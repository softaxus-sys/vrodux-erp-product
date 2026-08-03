using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.Restaurant.Domain.Entities;

namespace Softaxis.Restaurant.Infrastructure.Persistence.Configurations;

public sealed class RestaurantConfigurations :
    IEntityTypeConfiguration<Table>,
    IEntityTypeConfiguration<MenuCategory>,
    IEntityTypeConfiguration<MenuItem>,
    IEntityTypeConfiguration<Order>,
    IEntityTypeConfiguration<OrderItem>,
    IEntityTypeConfiguration<OrderPayment>,
    IEntityTypeConfiguration<OrderDiscount>,
    IEntityTypeConfiguration<OrderVoidLog>,
    IEntityTypeConfiguration<OrderRefund>,
    IEntityTypeConfiguration<OrderItemModifier>,
    IEntityTypeConfiguration<ModifierGroup>,
    IEntityTypeConfiguration<Modifier>,
    IEntityTypeConfiguration<MenuItemModifierGroup>,
    IEntityTypeConfiguration<Reservation>,
    IEntityTypeConfiguration<ReservationRule>,
    IEntityTypeConfiguration<Floor>,
    IEntityTypeConfiguration<DiningArea>,
    IEntityTypeConfiguration<TableTransferLog>,
    IEntityTypeConfiguration<WaitlistEntry>,
    IEntityTypeConfiguration<PrinterProfile>,
    IEntityTypeConfiguration<KitchenStation>,
    IEntityTypeConfiguration<Combo>,
    IEntityTypeConfiguration<ComboItem>,
    IEntityTypeConfiguration<HappyHourRule>,
    IEntityTypeConfiguration<DeliveryZone>,
    IEntityTypeConfiguration<Driver>,
    IEntityTypeConfiguration<DeliveryOrder>,
    IEntityTypeConfiguration<TableOrderingSession>,
    IEntityTypeConfiguration<DigitalReceiptLog>,
    IEntityTypeConfiguration<UserBranch>,
    IEntityTypeConfiguration<NotificationProviderConfig>,
    IEntityTypeConfiguration<DeviceRegistration>
{
    public void Configure(EntityTypeBuilder<Table> b)
    {
        b.ToTable("Tables");
        b.HasKey(x => x.Id);
        b.Property(x => x.TableNumber).HasMaxLength(20).IsRequired();
        b.Property(x => x.Section).HasMaxLength(50).IsRequired();
        b.Property(x => x.Status).HasMaxLength(30).IsRequired();
        b.Property(x => x.CurrentWaiter).HasMaxLength(200);
        b.Property(x => x.Shape).HasMaxLength(20).IsRequired().HasDefaultValue("square");
        // SQL-computed default (not a literal) so each existing row backfills a DISTINCT token —
        // QrCode carries a unique index; a shared literal default would collide across tables.
        b.Property(x => x.QrCode).HasMaxLength(64).IsRequired()
            .HasDefaultValueSql("REPLACE(CONVERT(nvarchar(64), NEWID()), '-', '')");
        b.HasIndex(x => x.BranchId);
        b.HasIndex(x => x.DiningAreaId);
        b.HasIndex(x => x.QrCode).IsUnique();
        b.HasQueryFilter(x => !x.IsDeleted);
    }

    public void Configure(EntityTypeBuilder<Floor> b)
    {
        b.ToTable("Floors");
        b.HasKey(x => x.Id);
        b.Property(x => x.Name).HasMaxLength(100).IsRequired();
        b.HasIndex(x => x.BranchId);
        b.HasQueryFilter(x => !x.IsDeleted);
    }

    public void Configure(EntityTypeBuilder<DiningArea> b)
    {
        b.ToTable("DiningAreas");
        b.HasKey(x => x.Id);
        b.Property(x => x.Name).HasMaxLength(100).IsRequired();
        b.Property(x => x.Type).HasMaxLength(30).IsRequired();
        b.HasIndex(x => x.FloorId);
        b.HasQueryFilter(x => !x.IsDeleted);
    }

    public void Configure(EntityTypeBuilder<TableTransferLog> b)
    {
        b.ToTable("TableTransferLogs");
        b.HasKey(x => x.Id);
        b.HasIndex(x => x.OrderId);
    }

    public void Configure(EntityTypeBuilder<WaitlistEntry> b)
    {
        b.ToTable("WaitlistEntries");
        b.HasKey(x => x.Id);
        b.Property(x => x.GuestName).HasMaxLength(200).IsRequired();
        b.Property(x => x.GuestPhone).HasMaxLength(50).IsRequired();
        b.Property(x => x.Status).HasMaxLength(30).IsRequired();
        b.Property(x => x.Notes).HasMaxLength(1000);
        b.HasIndex(x => x.BranchId);
        b.HasIndex(x => x.Status);
        b.HasQueryFilter(x => !x.IsDeleted);
    }

    public void Configure(EntityTypeBuilder<ReservationRule> b)
    {
        b.ToTable("ReservationRules");
        b.HasKey(x => x.Id);
        b.Property(x => x.DepositAmount).HasPrecision(18, 2);
        b.HasIndex(x => x.BranchId);
        b.HasQueryFilter(x => !x.IsDeleted);
    }

    public void Configure(EntityTypeBuilder<MenuCategory> b)
    {
        b.ToTable("MenuCategories");
        b.HasKey(x => x.Id);
        b.Property(x => x.Name).HasMaxLength(100).IsRequired();
        b.Property(x => x.Description).HasMaxLength(500);
        b.HasMany(x => x.Items).WithOne().HasForeignKey(i => i.CategoryId).OnDelete(DeleteBehavior.Cascade);
        b.HasQueryFilter(x => !x.IsDeleted);
    }

    public void Configure(EntityTypeBuilder<MenuItem> b)
    {
        b.ToTable("MenuItems");
        b.HasKey(x => x.Id);
        b.Property(x => x.Name).HasMaxLength(200).IsRequired();
        b.Property(x => x.Description).HasMaxLength(1000);
        b.Property(x => x.Price).HasPrecision(18, 2);
        b.Property(x => x.Allergens).HasMaxLength(500);
        b.Property(x => x.IsOnlineOrderable).HasDefaultValue(true);
        b.HasIndex(x => x.KitchenStationId);
        b.HasQueryFilter(x => !x.IsDeleted);
    }

    public void Configure(EntityTypeBuilder<PrinterProfile> b)
    {
        b.ToTable("PrinterProfiles");
        b.HasKey(x => x.Id);
        b.Property(x => x.Name).HasMaxLength(100).IsRequired();
        b.Property(x => x.Type).HasMaxLength(20).IsRequired();
        b.Property(x => x.ConnectionType).HasMaxLength(20).IsRequired();
        b.Property(x => x.IpAddress).HasMaxLength(50);
        b.HasIndex(x => x.BranchId);
        b.HasQueryFilter(x => !x.IsDeleted);
    }

    public void Configure(EntityTypeBuilder<KitchenStation> b)
    {
        b.ToTable("KitchenStations");
        b.HasKey(x => x.Id);
        b.Property(x => x.Name).HasMaxLength(100).IsRequired();
        b.Property(x => x.DisplayName).HasMaxLength(100);
        b.Property(x => x.ColorTag).HasMaxLength(20);
        b.HasIndex(x => x.BranchId);
        b.HasIndex(x => x.PrinterProfileId);
        b.HasQueryFilter(x => !x.IsDeleted);
    }

    public void Configure(EntityTypeBuilder<Combo> b)
    {
        b.ToTable("Combos");
        b.HasKey(x => x.Id);
        b.Property(x => x.Name).HasMaxLength(200).IsRequired();
        b.Property(x => x.Price).HasPrecision(18, 2);
        b.HasMany(x => x.Items).WithOne().HasForeignKey(i => i.ComboId).OnDelete(DeleteBehavior.Cascade);
        b.HasQueryFilter(x => !x.IsDeleted);
    }

    public void Configure(EntityTypeBuilder<ComboItem> b)
    {
        b.ToTable("ComboItems");
        b.HasKey(x => x.Id);
        b.Ignore(x => x.IsChoice);
        b.HasIndex(x => x.ComboId);
    }

    public void Configure(EntityTypeBuilder<HappyHourRule> b)
    {
        b.ToTable("HappyHourRules");
        b.HasKey(x => x.Id);
        b.Property(x => x.Name).HasMaxLength(100).IsRequired();
        b.Property(x => x.StartTime).HasMaxLength(10).IsRequired();
        b.Property(x => x.EndTime).HasMaxLength(10).IsRequired();
        b.Property(x => x.DiscountType).HasMaxLength(20).IsRequired();
        b.Property(x => x.DiscountValue).HasPrecision(18, 2);
        b.HasIndex(x => x.BranchId);
        b.HasQueryFilter(x => !x.IsDeleted);
    }

    public void Configure(EntityTypeBuilder<Order> b)
    {
        b.ToTable("Orders");
        b.HasKey(x => x.Id);
        b.Property(x => x.OrderNumber).HasMaxLength(50).IsRequired();
        b.Property(x => x.TableNumber).HasMaxLength(20).IsRequired();
        b.Property(x => x.Waiter).HasMaxLength(200).IsRequired();
        b.Property(x => x.Status).HasMaxLength(30).IsRequired();
        b.Property(x => x.OrderType).HasMaxLength(30).IsRequired();
        b.Property(x => x.OrderChannel).HasMaxLength(20).IsRequired().HasDefaultValue("pos");
        b.Property(x => x.SubTotal).HasPrecision(18, 2);
        b.Property(x => x.TaxAmount).HasPrecision(18, 2);
        b.Property(x => x.DiscountAmount).HasPrecision(18, 2);
        b.Property(x => x.Total).HasPrecision(18, 2);
        b.Property(x => x.PaymentMethod).HasMaxLength(50);
        b.Property(x => x.Notes).HasMaxLength(1000);
        b.Property(x => x.AmountPaid).HasPrecision(18, 2);
        b.Property(x => x.TipAmount).HasPrecision(18, 2);
        b.Property(x => x.RowVersion).IsRowVersion();
        b.HasIndex(x => x.BranchId);
        b.HasIndex(x => x.SessionId);
        b.HasIndex(x => x.ParentOrderId);
        // Self-referencing FK — Restrict (not Cascade) since Orders are never hard-deleted anyway,
        // and SQL Server rejects a self-referencing cascade path in some configurations regardless.
        b.HasOne<Order>().WithMany().HasForeignKey(x => x.ParentOrderId).OnDelete(DeleteBehavior.Restrict);
        b.HasMany(x => x.Items).WithOne().HasForeignKey(i => i.OrderId).OnDelete(DeleteBehavior.Cascade);
        b.HasMany(x => x.Payments).WithOne().HasForeignKey(p => p.OrderId).OnDelete(DeleteBehavior.Cascade);
        b.HasMany(x => x.Discounts).WithOne().HasForeignKey(d => d.OrderId).OnDelete(DeleteBehavior.Cascade);
        b.HasMany(x => x.VoidLogs).WithOne().HasForeignKey(v => v.OrderId).OnDelete(DeleteBehavior.Cascade);
        b.HasMany(x => x.Refunds).WithOne().HasForeignKey(r => r.OrderId).OnDelete(DeleteBehavior.Cascade);
        b.HasQueryFilter(x => !x.IsDeleted);
    }

    public void Configure(EntityTypeBuilder<OrderPayment> b)
    {
        b.ToTable("OrderPayments");
        b.HasKey(x => x.Id);
        b.Property(x => x.Method).HasMaxLength(50).IsRequired();
        b.Property(x => x.Amount).HasPrecision(18, 2);
        b.Property(x => x.Reference).HasMaxLength(200);
    }

    public void Configure(EntityTypeBuilder<OrderDiscount> b)
    {
        b.ToTable("OrderDiscounts");
        b.HasKey(x => x.Id);
        b.Property(x => x.Type).HasMaxLength(20).IsRequired();
        b.Property(x => x.Amount).HasPrecision(18, 2);
        b.Property(x => x.Reason).HasMaxLength(500).IsRequired();
        b.Property(x => x.VoidReason).HasMaxLength(500);
        b.HasIndex(x => x.OrderId);
    }

    public void Configure(EntityTypeBuilder<OrderVoidLog> b)
    {
        b.ToTable("OrderVoidLogs");
        b.HasKey(x => x.Id);
        b.Property(x => x.Reason).HasMaxLength(500).IsRequired();
        b.HasIndex(x => x.OrderId);
    }

    public void Configure(EntityTypeBuilder<OrderRefund> b)
    {
        b.ToTable("OrderRefunds");
        b.HasKey(x => x.Id);
        b.Property(x => x.Amount).HasPrecision(18, 2);
        b.Property(x => x.Reason).HasMaxLength(500).IsRequired();
        b.Property(x => x.Method).HasMaxLength(50).IsRequired();
        b.HasIndex(x => x.OrderId);
    }

    public void Configure(EntityTypeBuilder<OrderItem> b)
    {
        b.ToTable("OrderItems");
        b.HasKey(x => x.Id);
        b.Ignore(x => x.LineTotal);
        b.Property(x => x.ItemName).HasMaxLength(200).IsRequired();
        b.Property(x => x.UnitPrice).HasPrecision(18, 2);
        b.Property(x => x.Modifiers).HasMaxLength(500);
        b.Property(x => x.Status).HasMaxLength(30).IsRequired();
        b.Property(x => x.StockDeducted).HasDefaultValue(false);
        b.HasIndex(x => x.ComboOrderItemId);
        b.HasMany(x => x.SelectedModifiers).WithOne().HasForeignKey(m => m.OrderItemId).OnDelete(DeleteBehavior.Cascade);
        b.HasQueryFilter(x => !x.IsDeleted);
    }

    public void Configure(EntityTypeBuilder<OrderItemModifier> b)
    {
        b.ToTable("OrderItemModifiers");
        b.HasKey(x => x.Id);
        b.Property(x => x.Name).HasMaxLength(200).IsRequired();
        b.Property(x => x.PriceDelta).HasPrecision(18, 2);
        b.HasIndex(x => x.OrderItemId);
    }

    public void Configure(EntityTypeBuilder<ModifierGroup> b)
    {
        b.ToTable("ModifierGroups");
        b.HasKey(x => x.Id);
        b.Property(x => x.Name).HasMaxLength(100).IsRequired();
        b.HasMany(x => x.Modifiers).WithOne().HasForeignKey(m => m.ModifierGroupId).OnDelete(DeleteBehavior.Cascade);
        b.HasQueryFilter(x => !x.IsDeleted);
    }

    public void Configure(EntityTypeBuilder<Modifier> b)
    {
        b.ToTable("Modifiers");
        b.HasKey(x => x.Id);
        b.Property(x => x.Name).HasMaxLength(100).IsRequired();
        b.Property(x => x.PriceDelta).HasPrecision(18, 2);
        b.HasIndex(x => x.ModifierGroupId);
        b.HasQueryFilter(x => !x.IsDeleted);
    }

    public void Configure(EntityTypeBuilder<MenuItemModifierGroup> b)
    {
        b.ToTable("MenuItemModifierGroups");
        b.HasKey(x => x.Id);
        b.HasIndex(x => x.MenuItemId);
        b.HasIndex(x => new { x.MenuItemId, x.ModifierGroupId }).IsUnique();
    }

    public void Configure(EntityTypeBuilder<Reservation> b)
    {
        b.ToTable("Reservations");
        b.HasKey(x => x.Id);
        b.Property(x => x.ReservationNumber).HasMaxLength(50).IsRequired();
        b.Property(x => x.TableNumber).HasMaxLength(20);
        b.Property(x => x.GuestName).HasMaxLength(200).IsRequired();
        b.Property(x => x.GuestPhone).HasMaxLength(50).IsRequired();
        b.Property(x => x.GuestEmail).HasMaxLength(200);
        b.Property(x => x.ReservationDate).HasMaxLength(20).IsRequired();
        b.Property(x => x.ReservationTime).HasMaxLength(10).IsRequired();
        b.Property(x => x.Status).HasMaxLength(30).IsRequired();
        b.Property(x => x.SpecialRequests).HasMaxLength(1000);
        b.Property(x => x.ArrivalWindowStart).HasMaxLength(10);
        b.Property(x => x.ArrivalWindowEnd).HasMaxLength(10);
        b.HasIndex(x => x.BranchId);
        b.HasIndex(x => new { x.ReservationDate, x.Status });
        b.HasQueryFilter(x => !x.IsDeleted);
    }

    public void Configure(EntityTypeBuilder<DeliveryZone> b)
    {
        b.ToTable("DeliveryZones");
        b.HasKey(x => x.Id);
        b.Property(x => x.Name).HasMaxLength(100).IsRequired();
        b.Property(x => x.DeliveryFee).HasPrecision(18, 2);
        b.Property(x => x.MinOrderAmount).HasPrecision(18, 2);
        b.HasIndex(x => x.BranchId);
        b.HasQueryFilter(x => !x.IsDeleted);
    }

    public void Configure(EntityTypeBuilder<Driver> b)
    {
        b.ToTable("Drivers");
        b.HasKey(x => x.Id);
        b.Property(x => x.Name).HasMaxLength(200).IsRequired();
        b.Property(x => x.Phone).HasMaxLength(50).IsRequired();
        b.Property(x => x.VehicleInfo).HasMaxLength(200);
        b.HasIndex(x => x.BranchId);
        b.HasQueryFilter(x => !x.IsDeleted);
    }

    public void Configure(EntityTypeBuilder<DeliveryOrder> b)
    {
        b.ToTable("DeliveryOrders");
        b.HasKey(x => x.Id);
        b.Property(x => x.Status).HasMaxLength(20).IsRequired();
        b.Property(x => x.Address).HasMaxLength(500).IsRequired();
        b.Property(x => x.Phone).HasMaxLength(50).IsRequired();
        b.Property(x => x.DeliveryFee).HasPrecision(18, 2);
        b.Property(x => x.ThirdPartyProvider).HasMaxLength(50);
        b.Property(x => x.ThirdPartyOrderRef).HasMaxLength(100);
        b.Property(x => x.TrackingToken).HasMaxLength(64).IsRequired();
        b.HasIndex(x => x.OrderId);
        b.HasIndex(x => x.DriverId);
        b.HasIndex(x => x.TrackingToken).IsUnique();
        b.HasQueryFilter(x => !x.IsDeleted);
    }

    public void Configure(EntityTypeBuilder<TableOrderingSession> b)
    {
        b.ToTable("TableOrderingSessions");
        b.HasKey(x => x.Id);
        b.Property(x => x.GuestDeviceToken).HasMaxLength(100).IsRequired();
        b.HasIndex(x => x.TableId);
        b.HasIndex(x => x.GuestDeviceToken);
    }

    public void Configure(EntityTypeBuilder<DigitalReceiptLog> b)
    {
        b.ToTable("DigitalReceiptLogs");
        b.HasKey(x => x.Id);
        b.Property(x => x.Channel).HasMaxLength(20).IsRequired();
        b.Property(x => x.RecipientAddress).HasMaxLength(320).IsRequired();
        b.Property(x => x.Status).HasMaxLength(20).IsRequired();
        b.Property(x => x.ErrorMessage).HasMaxLength(500);
        b.HasIndex(x => x.OrderId);
    }

    public void Configure(EntityTypeBuilder<UserBranch> b)
    {
        b.ToTable("UserBranches");
        b.HasKey(x => x.Id);
        b.Property(x => x.UserName).HasMaxLength(200).IsRequired();
        b.Property(x => x.Role).HasMaxLength(20).IsRequired();
        b.HasIndex(x => x.UserId);
        b.HasIndex(x => new { x.UserId, x.BranchId }).IsUnique();
    }

    public void Configure(EntityTypeBuilder<NotificationProviderConfig> b)
    {
        b.ToTable("NotificationProviderConfigs");
        b.HasKey(x => x.Id);
        b.Property(x => x.Channel).HasMaxLength(20).IsRequired();
        b.Property(x => x.Provider).HasMaxLength(40).IsRequired();
        b.Property(x => x.AccountSidEncrypted).HasMaxLength(2000);
        b.Property(x => x.AuthTokenEncrypted).HasMaxLength(2000);
        b.Property(x => x.FromNumber).HasMaxLength(30);
        b.HasIndex(x => x.Channel); // non-unique — see the entity's own doc comment
    }

    public void Configure(EntityTypeBuilder<DeviceRegistration> b)
    {
        b.ToTable("DeviceRegistrations");
        b.HasKey(x => x.Id);
        b.Property(x => x.DeviceFingerprint).HasMaxLength(100).IsRequired();
        b.Property(x => x.DeviceName).HasMaxLength(150).IsRequired();
        b.HasIndex(x => x.DeviceFingerprint); // non-unique — see the entity's own doc comment
        b.HasIndex(x => x.BranchId);
    }
}
