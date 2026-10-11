using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Hospitality.Application.Bookings.Dtos;
using Softaxis.Hospitality.Domain.Entities;

namespace Softaxis.Hospitality.Application.Bookings.Commands;

public sealed record CreateBookingCommand(
    Guid RoomId, string GuestName, string GuestEmail, string GuestPhone,
    string GuestNationality, string CheckIn, string CheckOut, int Nights,
    int Adults, int Children, string Source, string? SpecialRequests,
    decimal? PaidAmount = null, string? PaymentMethod = null) : ICommand<CreateBookingResultDto>;

public sealed class CreateBookingValidator : AbstractValidator<CreateBookingCommand>
{
    public CreateBookingValidator()
    {
        RuleFor(x => x.GuestName).NotEmpty();
        RuleFor(x => x.GuestEmail).NotEmpty();
        RuleFor(x => x.GuestPhone).NotEmpty();
        RuleFor(x => x.GuestNationality).NotEmpty();
        RuleFor(x => x.CheckIn).NotEmpty();
        RuleFor(x => x.CheckOut).NotEmpty();
        RuleFor(x => x.Source).NotEmpty();
        RuleFor(x => x.PaymentMethod)
            .Must(m => m is not null && BookingPayment.Methods.Contains(m.Trim().ToLowerInvariant()))
            .When(x => x.PaidAmount is > 0)
            .WithMessage("Say how the deposit was paid: cash, card, bank transfer or cheque.");
    }
}

/// <summary>Records money a guest paid against a booking. Cannot be more than what is still owed.</summary>
public sealed record RecordBookingPaymentCommand(
    Guid BookingId, decimal Amount, string? Method, string? Reference, string? PaidOn) : ICommand<BookingPaymentDto>;

public sealed class RecordBookingPaymentValidator : AbstractValidator<RecordBookingPaymentCommand>
{
    public RecordBookingPaymentValidator()
    {
        RuleFor(x => x.Amount).GreaterThan(0).WithMessage("The payment must be more than zero.");
        RuleFor(x => x.Method)
            .Must(m => m is not null && BookingPayment.Methods.Contains(m.Trim().ToLowerInvariant()))
            .WithMessage("Say how the guest paid: cash, card, bank transfer or cheque.");
        RuleFor(x => x.PaidOn)
            .Must(d => string.IsNullOrWhiteSpace(d) || DateOnly.TryParseExact(d, "yyyy-MM-dd", out _))
            .WithMessage("The date must be yyyy-MM-dd.");
    }
}

public sealed record CheckInBookingCommand(Guid Id) : ICommand<BookingStatusDto>;

public sealed record CheckOutBookingCommand(Guid Id) : ICommand<BookingStatusDto>;
