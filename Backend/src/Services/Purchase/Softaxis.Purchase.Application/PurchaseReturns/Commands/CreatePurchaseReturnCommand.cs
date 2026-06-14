using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Purchase.Application.PurchaseReturns.Dtos;

namespace Softaxis.Purchase.Application.PurchaseReturns.Commands;

public sealed record PurchaseReturnItemRequest(
    Guid?   PurchaseOrderItemId,
    Guid?   ProductId,
    string  Description,
    decimal Quantity,
    decimal UnitCost);

/// <summary>Records a Purchase Return against a Purchase Order.</summary>
public sealed record CreatePurchaseReturnCommand(
    Guid    PurchaseOrderId,
    string  ReturnDate,
    string  Reason,
    string? Notes,
    IReadOnlyList<PurchaseReturnItemRequest> Items
) : ICommand<PurchaseReturnDto>;

public sealed class CreatePurchaseReturnValidator : AbstractValidator<CreatePurchaseReturnCommand>
{
    public CreatePurchaseReturnValidator()
    {
        RuleFor(x => x.PurchaseOrderId)
            .NotEmpty().WithMessage("Purchase order is required.");

        RuleFor(x => x.ReturnDate)
            .NotEmpty().WithMessage("Return date is required.");

        RuleFor(x => x.Reason)
            .NotEmpty().WithMessage("Return reason is required.")
            .MaximumLength(300).WithMessage("Reason must be ≤ 300 characters.");

        RuleFor(x => x.Notes)
            .MaximumLength(1000).WithMessage("Notes must be ≤ 1000 characters.")
            .When(x => x.Notes is not null);

        RuleFor(x => x.Items)
            .NotEmpty().WithMessage("At least one item is required.");

        RuleForEach(x => x.Items).ChildRules(item =>
        {
            item.RuleFor(i => i.Description)
                .NotEmpty().WithMessage("Item description is required.")
                .MaximumLength(300).WithMessage("Item description must be ≤ 300 characters.");

            item.RuleFor(i => i.Quantity)
                .GreaterThan(0).WithMessage("Return quantity must be greater than 0.");

            item.RuleFor(i => i.UnitCost)
                .GreaterThanOrEqualTo(0).WithMessage("Unit cost cannot be negative.");
        });
    }
}
