using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Hospitality.Application.Bookings.Dtos;

namespace Softaxis.Hospitality.Application.Bookings.Commands;

public sealed record CreateBookingCommand(
    Guid RoomId, string GuestName, string GuestEmail, string GuestPhone,
    string GuestNationality, string CheckIn, string CheckOut, int Nights,
    int Adults, int Children, string Source, string? SpecialRequests) : ICommand<CreateBookingResultDto>;

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
    }
}

public sealed record CheckInBookingCommand(Guid Id) : ICommand<BookingStatusDto>;

public sealed record CheckOutBookingCommand(Guid Id) : ICommand<BookingStatusDto>;
