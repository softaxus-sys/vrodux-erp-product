using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Restaurant.Application.Orders.Dtos;

namespace Softaxis.Restaurant.Application.Orders.Commands;

/// <summary>
/// POST /api/restaurant/orders/{id}/refund — refunds part or all of what's been paid so far.
/// Doesn't reverse the order's status away from "paid" (mirrors how POSTransaction refunds work —
/// the sale stays completed, the refund is a separately tracked cash-flow event). If the order was
/// opened under a tracked POS shift, the refund is recorded against that shift's TotalRefunds too
/// (see PosSessionLedger.RecordRefundAsync), same as the payment handlers do for sales.
/// </summary>
public sealed record RefundOrderCommand(
    Guid OrderId,
    decimal Amount,
    string Reason,
    string Method
) : ICommand<OrderDto>;

public sealed class RefundOrderValidator : AbstractValidator<RefundOrderCommand>
{
    public RefundOrderValidator()
    {
        RuleFor(x => x.Amount).GreaterThan(0).WithMessage("Refund amount must be greater than zero.");
        RuleFor(x => x.Method).NotEmpty().WithMessage("Refund method is required.");
        RuleFor(x => x.Reason)
            .NotEmpty().WithMessage("A reason is required to refund an order.")
            .MaximumLength(500).WithMessage("Reason must be ≤ 500 characters.");
    }
}
