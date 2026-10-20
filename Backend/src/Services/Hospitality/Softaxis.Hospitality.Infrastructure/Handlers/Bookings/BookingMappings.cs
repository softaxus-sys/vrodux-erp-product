using Softaxis.Hospitality.Application.Bookings.Dtos;
using Softaxis.Hospitality.Domain.Entities;

namespace Softaxis.Hospitality.Infrastructure.Handlers.Bookings;

internal static class BookingMappings
{
    public static BookingDto ToDto(Booking b) => new(
        b.Id, b.BookingNumber, b.RoomId, b.RoomNumber, b.RoomType,
        b.GuestName, b.GuestEmail, b.GuestPhone, b.GuestNationality,
        b.CheckIn, b.CheckOut, b.Nights, b.Adults, b.Children,
        b.RatePerNight, b.TotalAmount, b.PaidAmount, b.Balance,
        b.Status, b.Source, b.SpecialRequests,
        b.GuestId, b.RoomTypeId, b.RatePlanId, b.RatePlanName, b.MealPlan,
        b.RoomCharge, b.ExtrasTotal, b.DiscountAmount, b.ServiceAmount, b.TaxAmount, b.FeeAmount,
        b.CancelReason, b.Notes, b.ActualCheckInAt, b.ActualCheckOutAt, b.CreatedAt);
}
