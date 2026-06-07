using Microsoft.EntityFrameworkCore;
using Softaxis.RealEstate.Domain.Entities;

namespace Softaxis.RealEstate.Infrastructure.Persistence.Configurations;

/// <summary>Maps the CRM-linked sales lifecycle entities (site visits, reservations, bookings).</summary>
public static class SalesLifecycleConfig
{
    public static void Apply(ModelBuilder mb)
    {
        mb.Entity<SiteVisit>(b =>
        {
            b.ToTable("SiteVisits");
            b.HasKey(x => x.Id);
            b.Property(x => x.VisitNumber).HasMaxLength(40).IsRequired();
            b.Property(x => x.CustomerName).HasMaxLength(200).IsRequired();
            b.Property(x => x.ScheduledAt).HasMaxLength(30).IsRequired();
            b.Property(x => x.Status).HasMaxLength(20).IsRequired();
            b.Property(x => x.Feedback).HasMaxLength(1000);
            b.Property(x => x.AssignedTo).HasMaxLength(200);
            b.Property(x => x.Notes).HasMaxLength(1000);
            b.HasIndex(x => x.PropertyId);
            b.HasIndex(x => x.LeadId);
            b.HasQueryFilter(x => !x.IsDeleted);
        });

        mb.Entity<Reservation>(b =>
        {
            b.ToTable("Reservations");
            b.HasKey(x => x.Id);
            b.Property(x => x.ReservationNumber).HasMaxLength(40).IsRequired();
            b.Property(x => x.CustomerName).HasMaxLength(200).IsRequired();
            b.Property(x => x.ReservationDate).HasMaxLength(30).IsRequired();
            b.Property(x => x.ExpiryDate).HasMaxLength(30).IsRequired();
            b.Property(x => x.TokenAmount).HasPrecision(18, 2);
            b.Property(x => x.Status).HasMaxLength(20).IsRequired();
            b.Property(x => x.Notes).HasMaxLength(1000);
            b.HasIndex(x => x.UnitId);
            b.HasIndex(x => x.DealId);
            b.HasQueryFilter(x => !x.IsDeleted);
        });

        mb.Entity<Booking>(b =>
        {
            b.ToTable("Bookings");
            b.HasKey(x => x.Id);
            b.Property(x => x.BookingNumber).HasMaxLength(40).IsRequired();
            b.Property(x => x.CustomerName).HasMaxLength(200).IsRequired();
            b.Property(x => x.BookingDate).HasMaxLength(30).IsRequired();
            b.Property(x => x.SalePrice).HasPrecision(18, 2);
            b.Property(x => x.DownPayment).HasPrecision(18, 2);
            b.Property(x => x.PaidAmount).HasPrecision(18, 2);
            b.Property(x => x.Status).HasMaxLength(20).IsRequired();
            b.Property(x => x.Broker).HasMaxLength(200);
            b.Property(x => x.Notes).HasMaxLength(1000);
            b.Ignore(x => x.Balance);
            b.Ignore(x => x.InstallmentAmount);
            b.HasIndex(x => x.UnitId);
            b.HasIndex(x => x.DealId);
            b.HasQueryFilter(x => !x.IsDeleted);
        });
    }
}
