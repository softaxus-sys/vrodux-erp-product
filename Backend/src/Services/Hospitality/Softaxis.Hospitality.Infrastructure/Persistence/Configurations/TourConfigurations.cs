using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.Hospitality.Domain.Entities;

namespace Softaxis.Hospitality.Infrastructure.Persistence.Configurations;

public sealed class TourPackageConfiguration : IEntityTypeConfiguration<TourPackage>
{
    public void Configure(EntityTypeBuilder<TourPackage> b)
    {
        b.ToTable("TourPackages");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).ValueGeneratedNever();
        b.Property(x => x.Code).HasMaxLength(20).IsRequired();
        b.Property(x => x.Name).HasMaxLength(200).IsRequired();
        b.Property(x => x.Destination).HasMaxLength(200);
        b.Property(x => x.Category).HasMaxLength(50);
        b.Property(x => x.Description).HasMaxLength(4000);
        b.Property(x => x.Inclusions).HasMaxLength(4000);
        b.Property(x => x.Exclusions).HasMaxLength(4000);
        b.Property(x => x.PricePerAdult).HasPrecision(18, 2);
        b.Property(x => x.PricePerChild).HasPrecision(18, 2);
        b.Property(x => x.SingleSupplement).HasPrecision(18, 2);
        b.HasMany(x => x.Days).WithOne().HasForeignKey(d => d.TourPackageId).OnDelete(DeleteBehavior.Cascade);
        b.Navigation(x => x.Days).UsePropertyAccessMode(PropertyAccessMode.Field);
    }
}

public sealed class TourItineraryDayConfiguration : IEntityTypeConfiguration<TourItineraryDay>
{
    public void Configure(EntityTypeBuilder<TourItineraryDay> b)
    {
        b.ToTable("TourItineraryDays");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).ValueGeneratedNever();
        b.Property(x => x.Title).HasMaxLength(200).IsRequired();
        b.Property(x => x.Description).HasMaxLength(4000);
        b.Property(x => x.Accommodation).HasMaxLength(200);
        b.Property(x => x.Meals).HasMaxLength(50);
    }
}

public sealed class TourDepartureConfiguration : IEntityTypeConfiguration<TourDeparture>
{
    public void Configure(EntityTypeBuilder<TourDeparture> b)
    {
        b.ToTable("TourDepartures");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).ValueGeneratedNever();
        b.Property(x => x.StartDate).HasMaxLength(10).IsRequired();
        b.Property(x => x.EndDate).HasMaxLength(10).IsRequired();
        b.Property(x => x.AdultPrice).HasPrecision(18, 2);
        b.Property(x => x.ChildPrice).HasPrecision(18, 2);
        b.Property(x => x.Status).HasMaxLength(20).IsRequired();
        b.Property(x => x.Notes).HasMaxLength(1000);
        b.HasIndex(x => new { x.TourPackageId, x.StartDate });
    }
}

public sealed class TourBookingConfiguration : IEntityTypeConfiguration<TourBooking>
{
    public void Configure(EntityTypeBuilder<TourBooking> b)
    {
        b.ToTable("TourBookings");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).ValueGeneratedNever();
        b.Ignore(x => x.Balance);
        b.Ignore(x => x.Margin);
        b.Ignore(x => x.IsOpen);
        b.Property(x => x.BookingNumber).HasMaxLength(30).IsRequired();
        b.Property(x => x.Title).HasMaxLength(200).IsRequired();
        b.Property(x => x.StartDate).HasMaxLength(10).IsRequired();
        b.Property(x => x.EndDate).HasMaxLength(10).IsRequired();
        b.Property(x => x.CustomerName).HasMaxLength(200).IsRequired();
        b.Property(x => x.CustomerEmail).HasMaxLength(200);
        b.Property(x => x.CustomerPhone).HasMaxLength(50);
        foreach (var p in new[] { nameof(TourBooking.AdultPrice), nameof(TourBooking.ChildPrice), nameof(TourBooking.SingleSupplement),
                     nameof(TourBooking.PackageAmount), nameof(TourBooking.ExtrasAmount), nameof(TourBooking.DiscountAmount),
                     nameof(TourBooking.TaxAmount), nameof(TourBooking.TotalAmount), nameof(TourBooking.AmountPaid), nameof(TourBooking.CostAmount) })
            b.Property<decimal>(p).HasPrecision(18, 2);
        b.Property(x => x.TaxPercent).HasPrecision(5, 2);
        b.Property(x => x.Status).HasMaxLength(20).IsRequired();
        b.Property(x => x.Source).HasMaxLength(50);
        b.Property(x => x.CancelReason).HasMaxLength(500);
        b.Property(x => x.Notes).HasMaxLength(2000);
        b.Property(x => x.CreatedByName).HasMaxLength(200);
        b.HasIndex(x => x.DepartureId);
        b.HasIndex(x => x.StartDate);
        b.HasIndex(x => x.GuestId);
    }
}

public sealed class TourTravellerConfiguration : IEntityTypeConfiguration<TourTraveller>
{
    public void Configure(EntityTypeBuilder<TourTraveller> b)
    {
        b.ToTable("TourTravellers");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).ValueGeneratedNever();
        b.Property(x => x.FullName).HasMaxLength(200).IsRequired();
        b.Property(x => x.Type).HasMaxLength(10).IsRequired();
        b.Property(x => x.Gender).HasMaxLength(10);
        b.Property(x => x.DateOfBirth).HasMaxLength(10);
        b.Property(x => x.Nationality).HasMaxLength(100);
        b.Property(x => x.PassportNumber).HasMaxLength(50);
        b.Property(x => x.PassportExpiry).HasMaxLength(10);
        b.Property(x => x.Notes).HasMaxLength(500);
        b.HasIndex(x => x.TourBookingId);
    }
}

public sealed class TourServiceConfiguration : IEntityTypeConfiguration<TourService>
{
    public void Configure(EntityTypeBuilder<TourService> b)
    {
        b.ToTable("TourServices");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).ValueGeneratedNever();
        b.Ignore(x => x.SupplierBalance);
        b.Property(x => x.Type).HasMaxLength(20).IsRequired();
        b.Property(x => x.SupplierName).HasMaxLength(200).IsRequired();
        b.Property(x => x.Description).HasMaxLength(500).IsRequired();
        b.Property(x => x.ServiceDate).HasMaxLength(10);
        b.Property(x => x.EndDate).HasMaxLength(10);
        b.Property(x => x.ConfirmationNumber).HasMaxLength(100);
        b.Property(x => x.Cost).HasPrecision(18, 2);
        b.Property(x => x.SupplierPaid).HasPrecision(18, 2);
        b.Property(x => x.SellPrice).HasPrecision(18, 2);
        b.Property(x => x.Status).HasMaxLength(20).IsRequired();
        b.Property(x => x.Notes).HasMaxLength(1000);
        b.HasIndex(x => x.TourBookingId);
    }
}

public sealed class TourInstalmentConfiguration : IEntityTypeConfiguration<TourInstalment>
{
    public void Configure(EntityTypeBuilder<TourInstalment> b)
    {
        b.ToTable("TourInstalments");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).ValueGeneratedNever();
        b.Property(x => x.Label).HasMaxLength(100).IsRequired();
        b.Property(x => x.DueDate).HasMaxLength(10).IsRequired();
        b.Property(x => x.Amount).HasPrecision(18, 2);
        b.HasIndex(x => x.TourBookingId);
    }
}

public sealed class TourPaymentConfiguration : IEntityTypeConfiguration<TourPayment>
{
    public void Configure(EntityTypeBuilder<TourPayment> b)
    {
        b.ToTable("TourPayments");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).ValueGeneratedNever();
        b.Property(x => x.Amount).HasPrecision(18, 2);
        b.Property(x => x.Method).HasMaxLength(30).IsRequired();
        b.Property(x => x.Reference).HasMaxLength(100);
        b.Property(x => x.PaidOn).HasMaxLength(10).IsRequired();
        b.Property(x => x.ReceivedBy).HasMaxLength(200);
        b.Property(x => x.VoidReason).HasMaxLength(500);
        b.HasIndex(x => x.TourBookingId);
    }
}
