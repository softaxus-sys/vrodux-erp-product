using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Restaurant.Application.Orders.Dtos;

namespace Softaxis.Restaurant.Application.Orders.Commands;

/// <summary>PATCH /api/restaurant/orders/{id}/pay — pays the full outstanding balance with a single method.</summary>
public sealed record PayOrderCommand(Guid OrderId, string Method) : ICommand<OrderDto>;

public sealed class PayOrderValidator : AbstractValidator<PayOrderCommand>
{
    public PayOrderValidator()
    {
        RuleFor(x => x.Method).NotEmpty().WithMessage("Payment method is required.");
    }
}
