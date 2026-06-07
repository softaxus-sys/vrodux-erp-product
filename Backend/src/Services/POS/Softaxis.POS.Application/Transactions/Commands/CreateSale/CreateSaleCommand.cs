using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.POS.Application.DTOs;

namespace Softaxis.POS.Application.Transactions.Commands.CreateSale;

public sealed record CreateSaleCommand(
    Guid                        SessionId,
    Guid?                       CustomerId,
    IReadOnlyList<LineItemRequest> LineItems,
    IReadOnlyList<PaymentRequest>  Payments,
    string?                     Notes,
    OrderDiscountRequest?       OrderDiscount = null) : ICommand<POSTransactionDto>;

/// <summary>
/// Order-level discount descriptor. Resolved and validated server-side.
/// Type ∈ "none" | "percentage" | "fixed" | "voucher" | "loyalty".
/// </summary>
public sealed record OrderDiscountRequest(
    string   Type,
    decimal? Value,          // percentage (0-100) or fixed currency amount
    string?  VoucherCode,    // for type=voucher
    decimal? LoyaltyPoints); // for type=loyalty

public sealed class CreateSaleCommandValidator : AbstractValidator<CreateSaleCommand>
{
    public CreateSaleCommandValidator()
    {
        RuleFor(x => x.SessionId).NotEmpty();

        RuleFor(x => x.LineItems)
            .NotEmpty().WithMessage("Sale must have at least one line item.");

        RuleForEach(x => x.LineItems).ChildRules(item =>
        {
            item.RuleFor(i => i.ProductId).NotEmpty();
            item.RuleFor(i => i.Quantity).GreaterThan(0);
            item.RuleFor(i => i.DiscountPercent).InclusiveBetween(0, 100);
            item.RuleFor(i => i.DiscountAmount).GreaterThanOrEqualTo(0);
        });

        RuleFor(x => x.Payments)
            .NotEmpty().WithMessage("Sale must have at least one payment.");

        RuleForEach(x => x.Payments).ChildRules(pay =>
        {
            pay.RuleFor(p => p.Method).NotEmpty();
            pay.RuleFor(p => p.Amount).GreaterThan(0);
        });

        When(x => x.OrderDiscount is not null, () =>
        {
            RuleFor(x => x.OrderDiscount!.Type)
                .Must(t => t is "none" or "percentage" or "fixed" or "voucher" or "loyalty")
                .WithMessage("Invalid discount type.");

            RuleFor(x => x.OrderDiscount!.Value)
                .GreaterThan(0)
                .When(x => x.OrderDiscount!.Type is "percentage" or "fixed")
                .WithMessage("Discount value must be greater than zero.");

            RuleFor(x => x.OrderDiscount!.Value)
                .InclusiveBetween(0, 100)
                .When(x => x.OrderDiscount!.Type == "percentage")
                .WithMessage("Percentage discount must be between 0 and 100.");

            RuleFor(x => x.OrderDiscount!.VoucherCode)
                .NotEmpty()
                .When(x => x.OrderDiscount!.Type == "voucher")
                .WithMessage("Voucher code is required.");

            RuleFor(x => x.OrderDiscount!.LoyaltyPoints)
                .GreaterThan(0)
                .When(x => x.OrderDiscount!.Type == "loyalty")
                .WithMessage("Loyalty points to redeem must be greater than zero.");
        });
    }
}
