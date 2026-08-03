using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Restaurant.Application.Orders.Dtos;

namespace Softaxis.Restaurant.Application.Orders.Commands;

/// <summary>POST /api/restaurant/orders/{id}/items/{itemId}/void — replaces the old silent
/// soft-delete with an audited void (reason required, who voided it logged).</summary>
public sealed record VoidOrderItemCommand(Guid OrderId, Guid ItemId, string Reason) : ICommand<OrderDto>;

public sealed class VoidOrderItemValidator : AbstractValidator<VoidOrderItemCommand>
{
    public VoidOrderItemValidator()
    {
        RuleFor(x => x.Reason)
            .NotEmpty().WithMessage("A reason is required to void an item.")
            .MaximumLength(500).WithMessage("Reason must be ≤ 500 characters.");
    }
}
