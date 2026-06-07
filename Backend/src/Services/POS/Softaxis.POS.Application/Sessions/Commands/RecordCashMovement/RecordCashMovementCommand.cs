using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.POS.Application.DTOs;

namespace Softaxis.POS.Application.Sessions.Commands.RecordCashMovement;

/// <summary>Record a manual cash drawer movement. Type: "payin" | "payout".</summary>
public sealed record RecordCashMovementCommand(
    Guid    SessionId,
    string  Type,
    decimal Amount,
    string  Reason) : ICommand<CashMovementDto>;

public sealed class RecordCashMovementCommandValidator : AbstractValidator<RecordCashMovementCommand>
{
    public RecordCashMovementCommandValidator()
    {
        RuleFor(x => x.SessionId).NotEmpty();
        RuleFor(x => x.Type).Must(t => t is "payin" or "payout")
            .WithMessage("Type must be 'payin' or 'payout'.");
        RuleFor(x => x.Amount).GreaterThan(0);
        RuleFor(x => x.Reason).NotEmpty().MaximumLength(300);
    }
}
