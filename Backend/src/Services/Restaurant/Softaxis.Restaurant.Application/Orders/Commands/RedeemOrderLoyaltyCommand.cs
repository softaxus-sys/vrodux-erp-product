using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Restaurant.Application.Orders.Dtos;

namespace Softaxis.Restaurant.Application.Orders.Commands;

/// <summary>POST /api/restaurant/orders/{id}/loyalty — spends the linked customer's points on this
/// bill, replacing whatever discount was on it. Points = 0 takes the points back off.
/// Its own command rather than a discount type: a points redemption is the customer's entitlement,
/// so it does not need the authority to give a discount, and it has to move the customer's balance.</summary>
public sealed record RedeemOrderLoyaltyCommand(Guid OrderId, decimal Points) : ICommand<OrderDto>;

public sealed class RedeemOrderLoyaltyValidator : AbstractValidator<RedeemOrderLoyaltyCommand>
{
    public RedeemOrderLoyaltyValidator()
    {
        RuleFor(x => x.Points)
            .GreaterThanOrEqualTo(0).WithMessage("Points cannot be negative.")
            .Must(p => p == Math.Floor(p)).WithMessage("Points must be a whole number.");
    }
}
