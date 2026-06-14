using Softaxis.RealEstate.Application.Sales.Dtos;
using Softaxis.RealEstate.Domain.Entities;

namespace Softaxis.RealEstate.Infrastructure.Handlers.Sales;

internal static class SalesMappings
{
    public static SiteVisitDto ToDto(SiteVisit v) => new(
        v.Id, v.VisitNumber, v.LeadId, v.CustomerId, v.CustomerName, v.PropertyId, v.UnitId,
        v.ScheduledAt, v.Status, v.Feedback, v.AssignedTo, v.Notes, v.CreatedAt);

    public static ReservationDto ToDto(Reservation x) => new(
        x.Id, x.ReservationNumber, x.LeadId, x.DealId, x.CustomerId, x.CustomerName, x.PropertyId, x.UnitId,
        x.ReservationDate, x.ExpiryDate, x.TokenAmount, x.Status, x.Notes, x.CreatedAt);

    public static BookingDto ToDto(Booking b) => new(
        b.Id, b.BookingNumber, b.DealId, b.CustomerId, b.CustomerName, b.PropertyId, b.UnitId, b.BookingDate,
        b.SalePrice, b.DownPayment, b.InstallmentCount, b.InstallmentAmount, b.PaidAmount, b.Balance,
        b.Status, b.Broker, b.Notes, b.CreatedAt);
}
