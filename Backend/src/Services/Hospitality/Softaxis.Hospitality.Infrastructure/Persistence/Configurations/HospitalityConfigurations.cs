using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.Hospitality.Domain.Entities;

namespace Softaxis.Hospitality.Infrastructure.Persistence.Configurations;

public sealed class HospitalityConfigurations :
    IEntityTypeConfiguration<Room>,
    IEntityTypeConfiguration<Booking>,
    IEntityTypeConfiguration<HousekeepingTask>
{
    public void Configure(EntityTypeBuilder<Room> b)
    {
        b.ToTable("Rooms");
        b.HasKey(x => x.Id);
        b.Property(x => x.RoomNumber).HasMaxLength(20).IsRequired();
        b.Property(x => x.RoomType).HasMaxLength(50).IsRequired();
        b.Property(x => x.RatePerNight).HasPrecision(18, 2);
        b.Property(x => x.Status).HasMaxLength(30).IsRequired();
        b.Property(x => x.HousekeepingStatus).HasMaxLength(30).IsRequired();
        b.Property(x => x.CurrentGuestName).HasMaxLength(200);
        b.Property(x => x.CurrentBookingId).HasMaxLength(50);
        b.Property(x => x.View).HasMaxLength(50);
        b.Property(x => x.Notes).HasMaxLength(1000);
        b.HasIndex(x => x.RoomTypeId);
        b.HasQueryFilter(x => !x.IsDeleted);
    }

    public void Configure(EntityTypeBuilder<Booking> b)
    {
        b.ToTable("Bookings");
        b.HasKey(x => x.Id);
        b.Ignore(x => x.Balance);
        b.Ignore(x => x.IsOpen);
        b.Property(x => x.RatePlanName).HasMaxLength(100);
        b.Property(x => x.MealPlan).HasMaxLength(30);
        b.Property(x => x.RoomCharge).HasPrecision(18, 2);
        b.Property(x => x.ExtrasTotal).HasPrecision(18, 2);
        b.Property(x => x.DiscountAmount).HasPrecision(18, 2);
        b.Property(x => x.DiscountReason).HasMaxLength(300);
        b.Property(x => x.ServiceChargePercent).HasPrecision(9, 3);
        b.Property(x => x.ServiceAmount).HasPrecision(18, 2);
        b.Property(x => x.TaxPercent).HasPrecision(9, 3);
        b.Property(x => x.TaxAmount).HasPrecision(18, 2);
        b.Property(x => x.NightlyFee).HasPrecision(18, 2);
        b.Property(x => x.FeeAmount).HasPrecision(18, 2);
        b.Property(x => x.CancelReason).HasMaxLength(500);
        b.Property(x => x.Notes).HasMaxLength(2000);
        b.HasIndex(x => x.RoomId);
        b.HasIndex(x => x.GuestId);
        b.HasIndex(x => new { x.CheckIn, x.CheckOut });
        b.Property(x => x.BookingNumber).HasMaxLength(50).IsRequired();
        b.Property(x => x.RoomNumber).HasMaxLength(20).IsRequired();
        b.Property(x => x.RoomType).HasMaxLength(50).IsRequired();
        b.Property(x => x.GuestName).HasMaxLength(200).IsRequired();
        b.Property(x => x.GuestEmail).HasMaxLength(200).IsRequired();
        b.Property(x => x.GuestPhone).HasMaxLength(50).IsRequired();
        b.Property(x => x.GuestNationality).HasMaxLength(100).IsRequired();
        b.Property(x => x.CheckIn).HasMaxLength(20).IsRequired();
        b.Property(x => x.CheckOut).HasMaxLength(20).IsRequired();
        b.Property(x => x.RatePerNight).HasPrecision(18, 2);
        b.Property(x => x.TotalAmount).HasPrecision(18, 2);
        b.Property(x => x.PaidAmount).HasPrecision(18, 2);
        b.Property(x => x.Status).HasMaxLength(30).IsRequired();
        b.Property(x => x.Source).HasMaxLength(50).IsRequired();
        b.Property(x => x.SpecialRequests).HasMaxLength(1000);
        b.HasQueryFilter(x => !x.IsDeleted);
    }

    public void Configure(EntityTypeBuilder<HousekeepingTask> b)
    {
        b.ToTable("HousekeepingTasks");
        b.HasKey(x => x.Id);
        b.Property(x => x.RoomNumber).HasMaxLength(20).IsRequired();
        b.Property(x => x.TaskType).HasMaxLength(50).IsRequired();
        b.Property(x => x.Priority).HasMaxLength(20).IsRequired();
        b.Property(x => x.Status).HasMaxLength(30).IsRequired();
        b.Property(x => x.AssignedTo).HasMaxLength(200);
        b.Property(x => x.Notes).HasMaxLength(1000);
        b.HasQueryFilter(x => !x.IsDeleted);
    }
}

public sealed class BookingPaymentConfiguration : IEntityTypeConfiguration<BookingPayment>
{
    public void Configure(EntityTypeBuilder<BookingPayment> b)
    {
        b.ToTable("BookingPayments");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).ValueGeneratedNever();
        b.Property(x => x.Amount).HasPrecision(18, 2);
        b.Property(x => x.Method).HasMaxLength(20).IsRequired();
        b.Property(x => x.PaidOn).HasMaxLength(10).IsRequired();
        b.Property(x => x.Reference).HasMaxLength(100);
        b.HasIndex(x => x.BookingId);
    }
}
