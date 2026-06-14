using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.RealEstate.Application.Sales.Dtos;

namespace Softaxis.RealEstate.Application.Sales.Commands;

public sealed record CreateBookingCommand(
    Guid? DealId, Guid? CustomerId, string CustomerName, Guid PropertyId, Guid UnitId,
    string BookingDate, decimal SalePrice, decimal DownPayment, int InstallmentCount,
    string? Broker, string? Notes) : ICommand<BookingDto>;

public sealed class CreateBookingValidator : AbstractValidator<CreateBookingCommand>
{
    public CreateBookingValidator()
    {
        RuleFor(x => x.CustomerName).NotEmpty();
        RuleFor(x => x.BookingDate).NotEmpty();
        RuleFor(x => x.SalePrice).GreaterThan(0);
    }
}

public sealed record RecordBookingPaymentCommand(Guid Id, decimal Amount) : ICommand<BookingDto>;

public sealed record SetBookingStatusCommand(Guid Id, string Status) : ICommand;

public sealed class SetBookingStatusValidator : AbstractValidator<SetBookingStatusCommand>
{
    public SetBookingStatusValidator() => RuleFor(x => x.Status).NotEmpty();
}

public sealed record DeleteBookingCommand(Guid Id) : ICommand;
