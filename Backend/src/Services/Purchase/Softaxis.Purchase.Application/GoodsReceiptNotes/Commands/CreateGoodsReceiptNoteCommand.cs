using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Purchase.Application.GoodsReceiptNotes.Dtos;

namespace Softaxis.Purchase.Application.GoodsReceiptNotes.Commands;

public sealed record GoodsReceiptNoteItemRequest(
    Guid?   PurchaseOrderItemId,
    Guid?   ProductId,
    string  Description,
    decimal OrderedQuantity,
    decimal ReceivedQuantity,
    decimal UnitCost);

/// <summary>Records a Goods Receipt Note against a Purchase Order.</summary>
public sealed record CreateGoodsReceiptNoteCommand(
    Guid    PurchaseOrderId,
    string  GrnDate,
    string? DriverName,
    string? Notes,
    IReadOnlyList<GoodsReceiptNoteItemRequest> Items
) : ICommand<GoodsReceiptNoteDto>;

public sealed class CreateGoodsReceiptNoteValidator : AbstractValidator<CreateGoodsReceiptNoteCommand>
{
    public CreateGoodsReceiptNoteValidator()
    {
        RuleFor(x => x.PurchaseOrderId)
            .NotEmpty().WithMessage("Purchase order is required.");

        RuleFor(x => x.GrnDate)
            .NotEmpty().WithMessage("GRN date is required.");

        RuleFor(x => x.DriverName)
            .MaximumLength(200).WithMessage("Driver name must be ≤ 200 characters.")
            .When(x => x.DriverName is not null);

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

            item.RuleFor(i => i.ReceivedQuantity)
                .GreaterThan(0).WithMessage("Received quantity must be greater than 0.");

            item.RuleFor(i => i.UnitCost)
                .GreaterThanOrEqualTo(0).WithMessage("Unit cost cannot be negative.");
        });
    }
}
