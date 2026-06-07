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
        b.HasQueryFilter(x => !x.IsDeleted);
    }

    public void Configure(EntityTypeBuilder<Booking> b)
    {
        b.ToTable("Bookings");
        b.HasKey(x => x.Id);
        b.Ignore(x => x.Balance);
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
