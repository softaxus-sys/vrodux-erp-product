using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Restaurant.Application.Orders.Dtos;

namespace Softaxis.Restaurant.Application.Orders.Commands;

/// <summary>
/// POST /api/restaurant/orders — dine-in orders require a TableId; takeaway/delivery don't.
/// <paramref name="BranchId"/> is optional informational scoping (null = single-location tenant).
/// <paramref name="SessionId"/>, when provided, ties this order to an open POS shift so its sales
/// reconcile in that shift's cash-drawer total/Z-report; the order's CashierId is resolved
/// server-side from the caller's JWT, never trusted from the request.
/// </summary>
public sealed record CreateOrderCommand(
    Guid? TableId,
    string Waiter,
    int Covers,
    string OrderType,
    string? Notes,
    IReadOnlyList<OrderLineInput> Items,
    Guid? BranchId = null,
    Guid? SessionId = null,
    Guid? CustomerId = null
) : ICommand<OrderDto>;

public sealed class CreateOrderValidator : AbstractValidator<CreateOrderCommand>
{
    private static readonly string[] AllowedTypes = ["dine_in", "takeaway", "delivery"];

    public CreateOrderValidator()
    {
        RuleFor(x => x.Waiter).NotEmpty().WithMessage("Waiter is required.");

        RuleFor(x => x.OrderType)
            .Must(t => AllowedTypes.Contains(t))
            .WithMessage($"Order type must be one of: {string.Join(", ", AllowedTypes)}.");

        RuleFor(x => x.Covers).GreaterThanOrEqualTo(0).WithMessage("Covers cannot be negative.");

        RuleForEach(x => x.Items).ChildRules(item =>
        {
            item.RuleFor(i => i.Quantity).GreaterThan(0).WithMessage("Quantity must be greater than zero.");
        });
    }
}
