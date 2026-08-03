using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Restaurant.Application.Orders.Dtos;

namespace Softaxis.Restaurant.Application.Orders.Commands;

/// <summary>PATCH /api/restaurant/orders/{id}/tip — sets (or replaces) the tip, typically captured
/// just before payment. Blocked once the order is closed (paid/cancelled/split/held).</summary>
public sealed record SetOrderTipCommand(Guid OrderId, decimal Amount) : ICommand<OrderDto>;

public sealed class SetOrderTipValidator : AbstractValidator<SetOrderTipCommand>
{
    public SetOrderTipValidator()
    {
        RuleFor(x => x.Amount).GreaterThanOrEqualTo(0).WithMessage("Tip cannot be negative.");
    }
}

/// <summary>PATCH /api/restaurant/orders/{id}/customer — links (or unlinks, CustomerId=null) this
/// order to a POS customer, typically picked at the pay dialog for wallet/house-account payment.
/// Blocked once the order is closed, same as SetOrderTip.</summary>
public sealed record SetOrderCustomerCommand(Guid OrderId, Guid? CustomerId) : ICommand<OrderDto>;
