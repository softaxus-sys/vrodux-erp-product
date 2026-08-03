using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.POS.Application.DTOs;

namespace Softaxis.POS.Application.Customers.Commands.RecordHouseAccountPayment;

/// <summary>Records a payment against a customer's house-account balance — e.g. settling a
/// month-end statement. Doesn't generate the statement itself (design doc: reuse Finance's existing
/// invoicing for that, don't build a second billing engine) — this just posts the payment received.</summary>
public sealed record RecordHouseAccountPaymentCommand(Guid CustomerId, decimal Amount, string? Notes) : ICommand<CustomerDto>;

public sealed class RecordHouseAccountPaymentValidator : AbstractValidator<RecordHouseAccountPaymentCommand>
{
    public RecordHouseAccountPaymentValidator()
    {
        RuleFor(x => x.CustomerId).NotEmpty();
        RuleFor(x => x.Amount).GreaterThan(0).WithMessage("Payment amount must be greater than zero.");
    }
}
