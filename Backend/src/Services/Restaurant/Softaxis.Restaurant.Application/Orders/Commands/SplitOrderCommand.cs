using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Restaurant.Application.Orders.Dtos;

namespace Softaxis.Restaurant.Application.Orders.Commands;

/// <summary>
/// POST /api/restaurant/orders/{id}/split — splits an order's items across two or more new child
/// orders (a "split bill"), each independently payable. Every non-deleted item on the order must be
/// assigned to exactly one group — the handler validates the partition, not just this shape.
/// </summary>
public sealed record SplitOrderCommand(Guid OrderId, IReadOnlyList<SplitGroupInput> Groups) : ICommand<IReadOnlyList<OrderDto>>;

public sealed class SplitOrderValidator : AbstractValidator<SplitOrderCommand>
{
    public SplitOrderValidator()
    {
        RuleFor(x => x.Groups).Must(g => g.Count >= 2).WithMessage("A split needs at least 2 groups.");
        RuleForEach(x => x.Groups).ChildRules(g =>
        {
            g.RuleFor(x => x.ItemIds).NotEmpty().WithMessage("Each split group must have at least one item.");
        });
    }
}
