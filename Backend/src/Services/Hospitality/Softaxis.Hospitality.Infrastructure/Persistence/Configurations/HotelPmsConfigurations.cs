using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Softaxis.Hospitality.Domain.Entities;

namespace Softaxis.Hospitality.Infrastructure.Persistence.Configurations;

public sealed class RoomTypeConfiguration : IEntityTypeConfiguration<RoomType>
{
    public void Configure(EntityTypeBuilder<RoomType> b)
    {
        b.ToTable("RoomTypes");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).ValueGeneratedNever();
        b.Ignore(x => x.MaxOccupancy);
        b.Property(x => x.Code).HasMaxLength(20).IsRequired();
        b.Property(x => x.Name).HasMaxLength(100).IsRequired();
        b.Property(x => x.Description).HasMaxLength(1000);
        b.Property(x => x.Amenities).HasMaxLength(1000);
        b.Property(x => x.BaseRate).HasPrecision(18, 2);
    }
}

public sealed class GuestConfiguration : IEntityTypeConfiguration<Guest>
{
    public void Configure(EntityTypeBuilder<Guest> b)
    {
        b.ToTable("Guests");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).ValueGeneratedNever();
        b.Property(x => x.FullName).HasMaxLength(200).IsRequired();
        b.Property(x => x.Email).HasMaxLength(200);
        b.Property(x => x.Phone).HasMaxLength(50);
        b.Property(x => x.Nationality).HasMaxLength(100);
        b.Property(x => x.DocumentType).HasMaxLength(30);
        b.Property(x => x.DocumentNumber).HasMaxLength(50);
        b.Property(x => x.DocumentExpiry).HasMaxLength(10);
        b.Property(x => x.DateOfBirth).HasMaxLength(10);
        b.Property(x => x.Address).HasMaxLength(500);
        b.Property(x => x.Company).HasMaxLength(200);
        b.Property(x => x.Notes).HasMaxLength(2000);
        b.Property(x => x.TotalSpent).HasPrecision(18, 2);
        b.Property(x => x.LastStayOn).HasMaxLength(10);
        b.HasIndex(x => x.Email);
        b.HasIndex(x => x.Phone);
    }
}

public sealed class RatePlanConfiguration : IEntityTypeConfiguration<RatePlan>
{
    public void Configure(EntityTypeBuilder<RatePlan> b)
    {
        b.ToTable("RatePlans");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).ValueGeneratedNever();
        b.Property(x => x.Code).HasMaxLength(20).IsRequired();
        b.Property(x => x.Name).HasMaxLength(100).IsRequired();
        b.Property(x => x.MealPlan).HasMaxLength(30).IsRequired();
        b.Property(x => x.Description).HasMaxLength(1000);
    }
}

public sealed class SeasonalRateConfiguration : IEntityTypeConfiguration<SeasonalRate>
{
    public void Configure(EntityTypeBuilder<SeasonalRate> b)
    {
        b.ToTable("SeasonalRates");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).ValueGeneratedNever();
        b.Property(x => x.Label).HasMaxLength(100).IsRequired();
        b.Property(x => x.FromDate).HasMaxLength(10).IsRequired();
        b.Property(x => x.ToDate).HasMaxLength(10).IsRequired();
        b.Property(x => x.WeekdayRate).HasPrecision(18, 2);
        b.Property(x => x.WeekendRate).HasPrecision(18, 2);
        b.HasIndex(x => new { x.RatePlanId, x.RoomTypeId });
    }
}

public sealed class RoomBlockConfiguration : IEntityTypeConfiguration<RoomBlock>
{
    public void Configure(EntityTypeBuilder<RoomBlock> b)
    {
        b.ToTable("RoomBlocks");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).ValueGeneratedNever();
        b.Property(x => x.RoomNumber).HasMaxLength(20).IsRequired();
        b.Property(x => x.FromDate).HasMaxLength(10).IsRequired();
        b.Property(x => x.ToDate).HasMaxLength(10).IsRequired();
        b.Property(x => x.Reason).HasMaxLength(500).IsRequired();
        b.HasIndex(x => x.RoomId);
    }
}

public sealed class BookingNightConfiguration : IEntityTypeConfiguration<BookingNight>
{
    public void Configure(EntityTypeBuilder<BookingNight> b)
    {
        b.ToTable("BookingNights");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).ValueGeneratedNever();
        b.Property(x => x.Date).HasMaxLength(10).IsRequired();
        b.Property(x => x.Rate).HasPrecision(18, 2);
        b.HasIndex(x => x.BookingId);
    }
}

public sealed class FolioChargeConfiguration : IEntityTypeConfiguration<FolioCharge>
{
    public void Configure(EntityTypeBuilder<FolioCharge> b)
    {
        b.ToTable("FolioCharges");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).ValueGeneratedNever();
        b.Property(x => x.Date).HasMaxLength(10).IsRequired();
        b.Property(x => x.Category).HasMaxLength(30).IsRequired();
        b.Property(x => x.Description).HasMaxLength(300).IsRequired();
        b.Property(x => x.Quantity).HasPrecision(18, 3);
        b.Property(x => x.UnitPrice).HasPrecision(18, 2);
        b.Property(x => x.Amount).HasPrecision(18, 2);
        b.Property(x => x.PostedBy).HasMaxLength(200);
        b.Property(x => x.VoidReason).HasMaxLength(500);
        b.HasIndex(x => x.BookingId);
    }
}

public sealed class HotelSettingsConfiguration : IEntityTypeConfiguration<HotelSettings>
{
    public void Configure(EntityTypeBuilder<HotelSettings> b)
    {
        b.ToTable("HotelSettings");
        b.HasKey(x => x.Id);
        b.Property(x => x.Id).ValueGeneratedNever();
        b.Property(x => x.PropertyName).HasMaxLength(200);
        b.Property(x => x.WeekendDays).HasMaxLength(40).IsRequired();
        b.Property(x => x.CheckInTime).HasMaxLength(5).IsRequired();
        b.Property(x => x.CheckOutTime).HasMaxLength(5).IsRequired();
        b.Property(x => x.TaxPercent).HasPrecision(9, 3);
        b.Property(x => x.TaxLabel).HasMaxLength(30).IsRequired();
        b.Property(x => x.ServiceChargePercent).HasPrecision(9, 3);
        b.Property(x => x.NightlyFee).HasPrecision(18, 2);
        b.Property(x => x.NightlyFeeLabel).HasMaxLength(60);
    }
}
