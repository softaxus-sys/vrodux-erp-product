using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Restaurant.Application.Orders.Dtos;

namespace Softaxis.Restaurant.Application.Orders.Commands;

/// <summary>
/// PATCH /api/restaurant/orders/{id}/discount — audited discount application. Amount is the
/// already-computed discount value (e.g. the frontend converts a percentage into a currency
/// amount before sending); negative amounts are clamped to zero by the domain
/// (Order.ApplyDiscount). Supersedes (voids) any previously-active discount, matching the existing
/// "one active discount at a time" UX.
/// </summary>
public sealed record ApplyOrderDiscountCommand(
    Guid OrderId,
    string Type,
    decimal Amount,
    string Reason
) : ICommand<OrderDto>;

public sealed class ApplyOrderDiscountValidator : AbstractValidator<ApplyOrderDiscountCommand>
{
    private static readonly string[] AllowedTypes = ["flat", "percentage", "voucher"];

    public ApplyOrderDiscountValidator()
    {
        RuleFor(x => x.Type)
            .Must(t => AllowedTypes.Contains(t))
            .WithMessage($"Type must be one of: {string.Join(", ", AllowedTypes)}.");

        RuleFor(x => x.Reason)
            .NotEmpty().WithMessage("A reason is required to apply a discount.")
            .MaximumLength(500).WithMessage("Reason must be ≤ 500 characters.");
    }
}
