using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Restaurant.Application.Orders.Dtos;

namespace Softaxis.Restaurant.Application.Orders.Commands;

/// <summary>
/// POST /api/restaurant/orders/{id}/payments — records a (possibly partial) payment.
/// Supports split-tender (multiple methods on one bill) and split-bill (multiple guest payments).
/// Frees the table once the order is fully paid.
/// </summary>
public sealed record AddOrderPaymentCommand(
    Guid OrderId,
    string Method,
    decimal Amount,
    string? Reference
) : ICommand<OrderDto>;

public sealed class AddOrderPaymentValidator : AbstractValidator<AddOrderPaymentCommand>
{
    public AddOrderPaymentValidator()
    {
        RuleFor(x => x.Method).NotEmpty().WithMessage("Payment method is required.");
        RuleFor(x => x.Amount).GreaterThan(0).WithMessage("Amount must be greater than zero.");
    }
}
