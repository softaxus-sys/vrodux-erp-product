using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Restaurant.Application.Orders.Dtos;

namespace Softaxis.Restaurant.Application.Orders.Commands;

/// <summary>DELETE /api/restaurant/orders/{id}/discount — removes whatever discount is
/// currently active. Audited like every other discount mutation.</summary>
public sealed record RemoveOrderDiscountCommand(Guid OrderId, string Reason) : ICommand<OrderDto>;

public sealed class RemoveOrderDiscountValidator : AbstractValidator<RemoveOrderDiscountCommand>
{
    public RemoveOrderDiscountValidator()
    {
        RuleFor(x => x.Reason)
            .NotEmpty().WithMessage("A reason is required to remove a discount.")
            .MaximumLength(500).WithMessage("Reason must be ≤ 500 characters.");
    }
}
