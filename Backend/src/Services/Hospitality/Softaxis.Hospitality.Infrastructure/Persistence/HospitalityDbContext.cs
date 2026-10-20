using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Infrastructure.Persistence;
using Softaxis.Hospitality.Domain.Entities;
using Softaxis.Hospitality.Infrastructure.Persistence.Configurations;

namespace Softaxis.Hospitality.Infrastructure.Persistence;

public sealed class HospitalityDbContext(DbContextOptions<HospitalityDbContext> options) : DbContext(options), ITenantAmbientContext
{
    public DbSet<Room> Rooms => Set<Room>();
    public DbSet<Booking> Bookings => Set<Booking>();
    public DbSet<BookingPayment> BookingPayments => Set<BookingPayment>();
    public DbSet<HousekeepingTask> HousekeepingTasks => Set<HousekeepingTask>();
    public DbSet<RoomType> RoomTypes => Set<RoomType>();
    public DbSet<Guest> Guests => Set<Guest>();
    public DbSet<RatePlan> RatePlans => Set<RatePlan>();
    public DbSet<SeasonalRate> SeasonalRates => Set<SeasonalRate>();
    public DbSet<RoomBlock> RoomBlocks => Set<RoomBlock>();
    public DbSet<BookingNight> BookingNights => Set<BookingNight>();
    public DbSet<FolioCharge> FolioCharges => Set<FolioCharge>();
    public DbSet<HotelSettings> HotelSettings => Set<HotelSettings>();
    public DbSet<TourPackage> TourPackages => Set<TourPackage>();
    public DbSet<TourItineraryDay> TourItineraryDays => Set<TourItineraryDay>();
    public DbSet<TourDeparture> TourDepartures => Set<TourDeparture>();
    public DbSet<TourBooking> TourBookings => Set<TourBooking>();
    public DbSet<TourTraveller> TourTravellers => Set<TourTraveller>();
    public DbSet<TourService> TourServices => Set<TourService>();
    public DbSet<TourInstalment> TourInstalments => Set<TourInstalment>();
    public DbSet<TourPayment> TourPayments => Set<TourPayment>();

    protected override void OnModelCreating(ModelBuilder mb)
    {
        mb.HasDefaultSchema("hospitality");
        mb.ApplyConfigurationsFromAssembly(typeof(HospitalityConfigurations).Assembly);
        TenantIsolation.ApplyTenantId(mb, this, "Softaxis.Hospitality.Domain");

        // Room numbers and type / plan codes are what the desk and every report refer to: two
        // "101"s in one hotel make a booking ambiguous. Unique per tenant, live rows only.
        TenantIsolation.TenantUniqueIndex<Room>(mb, [nameof(Room.RoomNumber)]);
        TenantIsolation.TenantUniqueIndex<RoomType>(mb, [nameof(RoomType.Code)]);
        TenantIsolation.TenantUniqueIndex<RatePlan>(mb, [nameof(RatePlan.Code)]);
        TenantIsolation.TenantUniqueIndex<TourPackage>(mb, [nameof(TourPackage.Code)]);
        TenantIsolation.TenantUniqueIndex<TourBooking>(mb, [nameof(TourBooking.BookingNumber)]);
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        TenantIsolation.StampTenantId(ChangeTracker);
        return base.SaveChangesAsync(cancellationToken);
    }
}
