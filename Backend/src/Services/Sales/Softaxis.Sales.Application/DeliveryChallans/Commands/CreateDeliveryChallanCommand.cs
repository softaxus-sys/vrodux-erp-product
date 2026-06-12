using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Sales.Application.DeliveryChallans.Dtos;

namespace Softaxis.Sales.Application.DeliveryChallans.Commands;

public sealed record DeliveryChallanItemRequest(
    Guid?   SalesOrderItemId,
    Guid?   ProductId,
    string  Description,
    decimal OrderedQuantity,
    decimal DeliveredQuantity,
    decimal UnitPrice);

/// <summary>Records a Delivery Challan against a Sales Order.</summary>
public sealed record CreateDeliveryChallanCommand(
    Guid    SalesOrderId,
    string  ChallanDate,
    string? DriverName,
    string? Notes,
    IReadOnlyList<DeliveryChallanItemRequest> Items
) : ICommand<DeliveryChallanDto>;

public sealed class CreateDeliveryChallanValidator : AbstractValidator<CreateDeliveryChallanCommand>
{
    public CreateDeliveryChallanValidator()
    {
        RuleFor(x => x.SalesOrderId)
            .NotEmpty().WithMessage("Sales order is required.");

        RuleFor(x => x.ChallanDate)
            .NotEmpty().WithMessage("Challan date is required.");

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

            item.RuleFor(i => i.DeliveredQuantity)
                .GreaterThan(0).WithMessage("Delivered quantity must be greater than 0.");

            item.RuleFor(i => i.UnitPrice)
                .GreaterThanOrEqualTo(0).WithMessage("Unit price cannot be negative.");
        });
    }
}
