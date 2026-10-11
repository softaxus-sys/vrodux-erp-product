using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Hospitality.Application.Bookings.Commands;
using Softaxis.Hospitality.Application.Bookings.Dtos;
using Softaxis.Hospitality.Application.Bookings.Queries;
using Softaxis.Hospitality.Domain.Entities;
using Softaxis.Hospitality.Infrastructure.Persistence;

namespace Softaxis.Hospitality.Infrastructure.Handlers.Bookings;

internal sealed class RecordBookingPaymentHandler(HospitalityDbContext db)
    : ICommandHandler<RecordBookingPaymentCommand, BookingPaymentDto>
{
    public async Task<Result<BookingPaymentDto>> Handle(RecordBookingPaymentCommand cmd, CancellationToken ct)
    {
        // The tenant filter replaces the entity's soft-delete filter, so a deleted booking is excluded by hand.
        var booking = await db.Bookings.FirstOrDefaultAsync(b => b.Id == cmd.BookingId && !b.IsDeleted, ct);
        if (booking is null)
            return Result.Failure<BookingPaymentDto>(Error.NotFoundById("Booking", cmd.BookingId));

        if (booking.Status is "cancelled")
            return Result.Failure<BookingPaymentDto>(Error.Custom("Booking.Conflict",
                "A cancelled booking cannot take a payment."));

        var amount = Math.Round(cmd.Amount, 2);
        if (amount > booking.Balance + 0.005m)
            return Result.Failure<BookingPaymentDto>(Error.Custom("Booking.Conflict",
                $"The payment ({amount:N2}) is more than what is still owed ({booking.Balance:N2}). Record only what is owed; a refund or an extra charge is a different entry."));

        var paidOn = string.IsNullOrWhiteSpace(cmd.PaidOn) ? DateTime.UtcNow.ToString("yyyy-MM-dd") : cmd.PaidOn!;
        var payment = new BookingPayment(booking.Id, amount, cmd.Method!, paidOn, cmd.Reference);
        db.BookingPayments.Add(payment);
        booking.RecordPayment(amount);
        await db.SaveChangesAsync(ct);

        return Result.Success(new BookingPaymentDto(payment.Id, booking.Id, payment.Amount, payment.Method,
            payment.PaidOn, payment.Reference, booking.PaidAmount, booking.Balance));
    }
}

internal sealed class GetBookingPaymentsHandler(HospitalityDbContext db)
    : IQueryHandler<GetBookingPaymentsQuery, IReadOnlyList<BookingPaymentDto>>
{
    public async Task<Result<IReadOnlyList<BookingPaymentDto>>> Handle(GetBookingPaymentsQuery q, CancellationToken ct)
    {
        var booking = await db.Bookings.AsNoTracking().FirstOrDefaultAsync(b => b.Id == q.BookingId && !b.IsDeleted, ct);
        if (booking is null)
            return Result.Failure<IReadOnlyList<BookingPaymentDto>>(Error.NotFoundById("Booking", q.BookingId));

        var rows = await db.BookingPayments.AsNoTracking()
            .Where(p => p.BookingId == q.BookingId).OrderBy(p => p.PaidOn).ThenBy(p => p.CreatedAt).ToListAsync(ct);

        return Result.Success<IReadOnlyList<BookingPaymentDto>>(rows.Select(p => new BookingPaymentDto(
            p.Id, p.BookingId, p.Amount, p.Method, p.PaidOn, p.Reference, booking.PaidAmount, booking.Balance)).ToList());
    }
}
