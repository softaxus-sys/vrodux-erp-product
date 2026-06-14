using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.RealEstate.Application.Sales.Dtos;

namespace Softaxis.RealEstate.Application.Sales.Commands;

public sealed record CreateReservationCommand(
    Guid? LeadId, Guid? DealId, Guid? CustomerId, string CustomerName, Guid PropertyId, Guid UnitId,
    string ReservationDate, string ExpiryDate, decimal TokenAmount, string? Notes) : ICommand<ReservationDto>;

public sealed class CreateReservationValidator : AbstractValidator<CreateReservationCommand>
{
    public CreateReservationValidator()
    {
        RuleFor(x => x.CustomerName).NotEmpty();
        RuleFor(x => x.ReservationDate).NotEmpty();
        RuleFor(x => x.ExpiryDate).NotEmpty();
    }
}

public sealed record SetReservationStatusCommand(Guid Id, string Status) : ICommand;

public sealed class SetReservationStatusValidator : AbstractValidator<SetReservationStatusCommand>
{
    public SetReservationStatusValidator() => RuleFor(x => x.Status).NotEmpty();
}

public sealed record DeleteReservationCommand(Guid Id) : ICommand;
