using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Restaurant.Application.Orders.Dtos;

namespace Softaxis.Restaurant.Application.Orders.Commands;

/// <summary>PATCH /api/restaurant/orders/{id}/cancel — voids the whole order, audited
/// (reason required, who voided it logged). Replaces the old bare status flip.</summary>
public sealed record VoidOrderCommand(Guid OrderId, string Reason) : ICommand<OrderDto>;

public sealed class VoidOrderValidator : AbstractValidator<VoidOrderCommand>
{
    public VoidOrderValidator()
    {
        RuleFor(x => x.Reason)
            .NotEmpty().WithMessage("A reason is required to void an order.")
            .MaximumLength(500).WithMessage("Reason must be ≤ 500 characters.");
    }
}
