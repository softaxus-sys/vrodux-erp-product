using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Hospitality.Application.Bookings.Dtos;
using Softaxis.Hospitality.Domain.Entities;

namespace Softaxis.Hospitality.Application.Bookings.Commands;

internal static class StayRules
{
    public static bool IsDate(string? s) => DateOnly.TryParseExact(s, "yyyy-MM-dd", out _);
    public static bool IsMethod(string? m) => m is not null && BookingPayment.Methods.Contains(m.Trim().ToLowerInvariant());
}

/// <summary>
/// Takes a reservation. Nights and price are worked out on the server from the dates, the room and
/// the rate plan — a client-sent total is never trusted. <see cref="Nights"/> is accepted for older
/// callers and ignored.
/// </summary>
public sealed record CreateBookingCommand(
    Guid    RoomId,
    string  GuestName,
    string? GuestEmail,
    string? GuestPhone,
    string? GuestNationality,
    string  CheckIn,
    string  CheckOut,
    int     Nights,
    int     Adults,
    int     Children,
    string  Source,
    string? SpecialRequests,
    decimal? PaidAmount     = null,
    string?  PaymentMethod  = null,
    Guid?    GuestId        = null,
    Guid?    RatePlanId     = null,
    decimal? DiscountAmount = null,
    string?  DiscountReason = null,
    string?  Notes          = null,
    string?  PaymentReference = null) : ICommand<CreateBookingResultDto>;

public sealed class CreateBookingValidator : AbstractValidator<CreateBookingCommand>
{
    public CreateBookingValidator()
    {
        RuleFor(x => x.RoomId).NotEmpty().WithMessage("Pick a room.");
        RuleFor(x => x.GuestName).NotEmpty().WithMessage("Guest name is required.").MaximumLength(200);
        RuleFor(x => x.GuestEmail).EmailAddress().When(x => !string.IsNullOrWhiteSpace(x.GuestEmail))
            .WithMessage("That email address does not look right.");
        RuleFor(x => x.CheckIn).Must(StayRules.IsDate).WithMessage("Arrival date must be yyyy-MM-dd.");
        RuleFor(x => x.CheckOut).Must(StayRules.IsDate).WithMessage("Departure date must be yyyy-MM-dd.");
        RuleFor(x => x).Must(x => string.CompareOrdinal(x.CheckOut, x.CheckIn) > 0)
            .When(x => StayRules.IsDate(x.CheckIn) && StayRules.IsDate(x.CheckOut))
            .WithMessage("Departure must be after arrival.");
        RuleFor(x => x.Adults).InclusiveBetween(1, 20).WithMessage("At least one adult.");
        RuleFor(x => x.Children).InclusiveBetween(0, 20);
        RuleFor(x => x.Source).NotEmpty();
        RuleFor(x => x.DiscountAmount).GreaterThanOrEqualTo(0).When(x => x.DiscountAmount.HasValue);
        RuleFor(x => x.PaymentMethod).Must(StayRules.IsMethod).When(x => x.PaidAmount is > 0)
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
        RuleFor(x => x.Method).Must(StayRules.IsMethod)
            .WithMessage("Say how the guest paid: cash, card, bank transfer or cheque.");
        RuleFor(x => x.PaidOn).Must(d => string.IsNullOrWhiteSpace(d) || StayRules.IsDate(d))
            .WithMessage("The date must be yyyy-MM-dd.");
    }
}

/// <summary>
/// <paramref name="RoomId"/> lets the desk swap to another free room at arrival (the booked one is
/// not ready). <paramref name="Today"/> is the desk's own date; see LibraryDates for why.
/// </summary>
public sealed record CheckInBookingCommand(Guid Id, string? Today = null, Guid? RoomId = null) : ICommand<BookingStatusDto>;

/// <summary>Refused while money is owed unless <paramref name="AllowBalance"/> (city ledger / company pays later).</summary>
public sealed record CheckOutBookingCommand(Guid Id, string? Today = null, bool AllowBalance = false) : ICommand<BookingStatusDto>;

/// <summary>Changes the dates of a stay. A guest already in house can only change the departure.</summary>
public sealed record AmendStayCommand(Guid Id, string CheckIn, string CheckOut) : ICommand<BookingDto>;

public sealed class AmendStayValidator : AbstractValidator<AmendStayCommand>
{
    public AmendStayValidator()
    {
        RuleFor(x => x.CheckIn).Must(StayRules.IsDate).WithMessage("Arrival date must be yyyy-MM-dd.");
        RuleFor(x => x.CheckOut).Must(StayRules.IsDate).WithMessage("Departure date must be yyyy-MM-dd.");
        RuleFor(x => x).Must(x => string.CompareOrdinal(x.CheckOut, x.CheckIn) > 0)
            .When(x => StayRules.IsDate(x.CheckIn) && StayRules.IsDate(x.CheckOut))
            .WithMessage("Departure must be after arrival.");
    }
}

public sealed record UpdateBookingDetailsCommand(
    Guid Id, string GuestName, string? GuestEmail, string? GuestPhone, string? GuestNationality,
    int Adults, int Children, string Source, string? SpecialRequests, string? Notes) : ICommand<BookingDto>;

public sealed class UpdateBookingDetailsValidator : AbstractValidator<UpdateBookingDetailsCommand>
{
    public UpdateBookingDetailsValidator()
    {
        RuleFor(x => x.GuestName).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Adults).InclusiveBetween(1, 20);
        RuleFor(x => x.Children).InclusiveBetween(0, 20);
        RuleFor(x => x.Source).NotEmpty();
    }
}

/// <summary>Moves a stay to another room. Prices stay as booked unless <paramref name="Reprice"/>.</summary>
public sealed record MoveRoomCommand(Guid Id, Guid RoomId, bool Reprice = false) : ICommand<BookingDto>;

/// <summary>A fee, when charged, becomes a folio line and the stay's only charge.</summary>
public sealed record CancelBookingCommand(Guid Id, string Reason, decimal? CancellationFee = null) : ICommand<BookingStatusDto>;

public sealed class CancelBookingValidator : AbstractValidator<CancelBookingCommand>
{
    public CancelBookingValidator()
    {
        RuleFor(x => x.Reason).NotEmpty().WithMessage("Say why the booking is cancelled.").MaximumLength(500);
        RuleFor(x => x.CancellationFee).GreaterThanOrEqualTo(0).When(x => x.CancellationFee.HasValue);
    }
}

public sealed record MarkNoShowCommand(Guid Id, string? Today = null, decimal? NoShowFee = null) : ICommand<BookingStatusDto>;

public sealed record PostFolioChargeCommand(
    Guid BookingId, string Category, string Description, decimal Quantity, decimal UnitPrice,
    string? Date = null, string? PostedBy = null) : ICommand<FolioDto>;

public sealed class PostFolioChargeValidator : AbstractValidator<PostFolioChargeCommand>
{
    public PostFolioChargeValidator()
    {
        RuleFor(x => x.Category).Must(c => FolioCharge.Categories.Contains(c?.Trim().ToLowerInvariant()))
            .WithMessage("Pick a charge category.");
        RuleFor(x => x.Description).NotEmpty().MaximumLength(300);
        RuleFor(x => x.Quantity).GreaterThan(0).LessThanOrEqualTo(10_000);
        RuleFor(x => x.UnitPrice).GreaterThan(0).WithMessage("The price must be more than zero. Use a discount to take money off.");
        RuleFor(x => x.Date).Must(d => string.IsNullOrWhiteSpace(d) || StayRules.IsDate(d));
    }
}

public sealed record VoidFolioChargeCommand(Guid BookingId, Guid ChargeId, string Reason) : ICommand<FolioDto>;

public sealed class VoidFolioChargeValidator : AbstractValidator<VoidFolioChargeCommand>
{
    public VoidFolioChargeValidator() =>
        RuleFor(x => x.Reason).NotEmpty().WithMessage("Say why the charge is voided.").MaximumLength(500);
}

public sealed record SetBookingDiscountCommand(Guid BookingId, decimal Amount, string? Reason) : ICommand<FolioDto>;

public sealed class SetBookingDiscountValidator : AbstractValidator<SetBookingDiscountCommand>
{
    public SetBookingDiscountValidator()
    {
        RuleFor(x => x.Amount).GreaterThanOrEqualTo(0);
        RuleFor(x => x.Reason).NotEmpty().When(x => x.Amount > 0).WithMessage("Say why the discount is given.");
    }
}
