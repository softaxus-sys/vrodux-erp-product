using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Infrastructure.Persistence;
using Softaxis.Restaurant.Domain.Entities;
using Softaxis.Restaurant.Infrastructure.Persistence.Configurations;

namespace Softaxis.Restaurant.Infrastructure.Persistence;

public sealed class RestaurantDbContext(DbContextOptions<RestaurantDbContext> options) : DbContext(options), ITenantAmbientContext
{
    public DbSet<Table> Tables => Set<Table>();
    public DbSet<MenuCategory> MenuCategories => Set<MenuCategory>();
    public DbSet<MenuItem> MenuItems => Set<MenuItem>();
    public DbSet<Order> Orders => Set<Order>();
    public DbSet<OrderItem> OrderItems => Set<OrderItem>();
    public DbSet<OrderPayment> OrderPayments => Set<OrderPayment>();
    public DbSet<OrderDiscount> OrderDiscounts => Set<OrderDiscount>();
    public DbSet<OrderVoidLog> OrderVoidLogs => Set<OrderVoidLog>();
    public DbSet<OrderRefund> OrderRefunds => Set<OrderRefund>();
    public DbSet<OrderItemModifier> OrderItemModifiers => Set<OrderItemModifier>();
    public DbSet<ModifierGroup> ModifierGroups => Set<ModifierGroup>();
    public DbSet<Modifier> Modifiers => Set<Modifier>();
    public DbSet<MenuItemModifierGroup> MenuItemModifierGroups => Set<MenuItemModifierGroup>();
    public DbSet<MenuItemImage> MenuItemImages => Set<MenuItemImage>();
    public DbSet<Reservation> Reservations => Set<Reservation>();
    public DbSet<ReservationRule> ReservationRules => Set<ReservationRule>();
    public DbSet<Floor> Floors => Set<Floor>();
    public DbSet<DiningArea> DiningAreas => Set<DiningArea>();
    public DbSet<TableTransferLog> TableTransferLogs => Set<TableTransferLog>();
    public DbSet<WaitlistEntry> WaitlistEntries => Set<WaitlistEntry>();
    public DbSet<PrinterProfile> PrinterProfiles => Set<PrinterProfile>();
    public DbSet<KitchenStation> KitchenStations => Set<KitchenStation>();
    public DbSet<Combo> Combos => Set<Combo>();
    public DbSet<ComboItem> ComboItems => Set<ComboItem>();
    public DbSet<HappyHourRule> HappyHourRules => Set<HappyHourRule>();
    public DbSet<DeliveryZone> DeliveryZones => Set<DeliveryZone>();
    public DbSet<Driver> Drivers => Set<Driver>();
    public DbSet<DeliveryOrder> DeliveryOrders => Set<DeliveryOrder>();
    public DbSet<TableOrderingSession> TableOrderingSessions => Set<TableOrderingSession>();
    public DbSet<DigitalReceiptLog> DigitalReceiptLogs => Set<DigitalReceiptLog>();
    public DbSet<UserBranch> UserBranches => Set<UserBranch>();
    public DbSet<MenuItemBranchSetting> MenuItemBranchSettings => Set<MenuItemBranchSetting>();
    public DbSet<OfflineOp> OfflineOps => Set<OfflineOp>();
    public DbSet<TaxProfile> TaxProfiles => Set<TaxProfile>();
    public DbSet<PlatformConnection> PlatformConnections => Set<PlatformConnection>();
    public DbSet<NotificationProviderConfig> NotificationProviderConfigs => Set<NotificationProviderConfig>();
    public DbSet<DeviceRegistration> DeviceRegistrations => Set<DeviceRegistration>();
    public DbSet<BranchInstruction> BranchInstructions => Set<BranchInstruction>();
    public DbSet<BranchInstructionResult> BranchInstructionResults => Set<BranchInstructionResult>();
    public DbSet<RelayedOrder> RelayedOrders => Set<RelayedOrder>();
    public DbSet<RelayedOrderResult> RelayedOrderResults => Set<RelayedOrderResult>();
    public DbSet<PlatformActionRequest> PlatformActionRequests => Set<PlatformActionRequest>();
    public DbSet<PlatformActionResult> PlatformActionResults => Set<PlatformActionResult>();

    protected override void OnModelCreating(ModelBuilder mb)
    {
        mb.HasDefaultSchema("restaurant");
        mb.ApplyConfigurationsFromAssembly(typeof(RestaurantConfigurations).Assembly);
        TenantIsolation.ApplyTenantId(mb, this, "Softaxis.Restaurant.Domain");
        // An offline action is applied once per workspace; an offline order is created once.
        TenantIsolation.TenantUniqueIndex<OfflineOp>(mb, [nameof(OfflineOp.OpId)], excludeSoftDeleted: false);
        TenantIsolation.TenantUniqueIndex<Order>(mb, [nameof(Order.ClientRef)], extraFilter: "[ClientRef] IS NOT NULL");
    }

    public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        TenantIsolation.StampTenantId(ChangeTracker);
        await Common.OrderNumbering.AssignAsync(this, cancellationToken);
        return await base.SaveChangesAsync(cancellationToken);
    }
}
