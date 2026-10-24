using Softaxis.Restaurant.Application.Abstractions;
using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Restaurant.Application.Orders.Dtos;

namespace Softaxis.Restaurant.Application.Orders.Commands;

/// <summary>POST /api/restaurant/orders/{id}/items</summary>
public sealed record AddOrderItemsCommand(
    Guid OrderId,
    IReadOnlyList<OrderLineInput> Items,
    /// <summary>True only for the offline upload: honours the till's recorded prices.</summary>
    bool Offline = false
) : IOrderScopedCommand, ICommand<OrderDto>;

public sealed class AddOrderItemsValidator : AbstractValidator<AddOrderItemsCommand>
{
    public AddOrderItemsValidator()
    {
        RuleFor(x => x.Items).NotEmpty().WithMessage("At least one item is required.");

        RuleForEach(x => x.Items).ChildRules(item =>
        {
            item.RuleFor(i => i.Quantity).GreaterThan(0).WithMessage("Quantity must be greater than zero.");
        });
    }
}
