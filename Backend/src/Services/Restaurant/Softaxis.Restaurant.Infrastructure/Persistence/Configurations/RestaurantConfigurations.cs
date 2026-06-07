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
    IEntityTypeConfiguration<Reservation>
{
    public void Configure(EntityTypeBuilder<Table> b)
    {
        b.ToTable("Tables");
        b.HasKey(x => x.Id);
        b.Property(x => x.TableNumber).HasMaxLength(20).IsRequired();
        b.Property(x => x.Section).HasMaxLength(50).IsRequired();
        b.Property(x => x.Status).HasMaxLength(30).IsRequired();
        b.Property(x => x.CurrentWaiter).HasMaxLength(200);
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
        b.Property(x => x.SubTotal).HasPrecision(18, 2);
        b.Property(x => x.TaxAmount).HasPrecision(18, 2);
        b.Property(x => x.DiscountAmount).HasPrecision(18, 2);
        b.Property(x => x.Total).HasPrecision(18, 2);
        b.Property(x => x.PaymentMethod).HasMaxLength(50);
        b.Property(x => x.Notes).HasMaxLength(1000);
        b.Property(x => x.AmountPaid).HasPrecision(18, 2);
        b.HasMany(x => x.Items).WithOne().HasForeignKey(i => i.OrderId).OnDelete(DeleteBehavior.Cascade);
        b.HasMany(x => x.Payments).WithOne().HasForeignKey(p => p.OrderId).OnDelete(DeleteBehavior.Cascade);
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

    public void Configure(EntityTypeBuilder<OrderItem> b)
    {
        b.ToTable("OrderItems");
        b.HasKey(x => x.Id);
        b.Ignore(x => x.LineTotal);
        b.Property(x => x.ItemName).HasMaxLength(200).IsRequired();
        b.Property(x => x.UnitPrice).HasPrecision(18, 2);
        b.Property(x => x.Modifiers).HasMaxLength(500);
        b.Property(x => x.Status).HasMaxLength(30).IsRequired();
        b.HasQueryFilter(x => !x.IsDeleted);
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
        b.HasQueryFilter(x => !x.IsDeleted);
    }
}
