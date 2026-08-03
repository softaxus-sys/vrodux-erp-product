using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Restaurant.Application.Reservations.Dtos;

namespace Softaxis.Restaurant.Application.Reservations.Commands;

/// <summary>POST /api/restaurant/reservations</summary>
public sealed record CreateReservationCommand(
    string GuestName,
    string GuestPhone,
    string? GuestEmail,
    int Covers,
    string ReservationDate,
    string ReservationTime,
    string? SpecialRequests,
    Guid? TableId,
    Guid? BranchId = null,
    string? ArrivalWindowStart = null,
    string? ArrivalWindowEnd = null
) : ICommand<ReservationCreatedDto>;

public sealed class CreateReservationValidator : AbstractValidator<CreateReservationCommand>
{
    public CreateReservationValidator()
    {
        RuleFor(x => x.GuestName).NotEmpty().WithMessage("Guest name is required.");
        RuleFor(x => x.GuestPhone).NotEmpty().WithMessage("Guest phone is required.");
        RuleFor(x => x.Covers).GreaterThan(0).WithMessage("Covers must be greater than zero.");
        RuleFor(x => x.ReservationDate).NotEmpty().WithMessage("Reservation date is required.");
        RuleFor(x => x.ReservationTime).NotEmpty().WithMessage("Reservation time is required.");
        RuleFor(x => x.GuestEmail)
            .EmailAddress().WithMessage("Invalid email address.")
            .When(x => !string.IsNullOrWhiteSpace(x.GuestEmail));
    }
}
