using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Manufacturing.Application.ProductionOrders.Dtos;

namespace Softaxis.Manufacturing.Application.ProductionOrders.Commands;

/// <param name="PlanSubAssemblies">
/// Also plan an order for every component that is itself manufactured (has an active BOM) and is
/// short in stock — and so on down the structure.
/// </param>
public sealed record CreateProductionOrderCommand(
    Guid BomId, decimal PlannedQuantity, Guid? WarehouseId, string? PlannedStartDate,
    string? DueDate, string? Reference, string? Notes, bool PlanSubAssemblies = false) : ICommand<ProductionOrderDto>;

/// <summary>Re-plans an order that has not been released yet.</summary>
public sealed record UpdateProductionOrderCommand(
    Guid Id, decimal PlannedQuantity, Guid? WarehouseId, string? PlannedStartDate,
    string? DueDate, string? Reference, string? Notes) : ICommand<ProductionOrderDto>;

public sealed record ReleaseProductionOrderCommand(Guid Id) : ICommand<ProductionOrderDto>;

/// <param name="BatchNumber">The material batch being drawn from (or returned to), for traceability.</param>
public sealed record IssueLineInput(Guid ComponentId, decimal Quantity, string? BatchNumber = null);

/// <summary>
/// Takes components out of stock for an order. An empty <see cref="Lines"/> means
/// "everything still outstanding".
/// </summary>
public sealed record IssueMaterialsCommand(Guid Id, IReadOnlyList<IssueLineInput>? Lines)
    : ICommand<ProductionOrderDto>;

/// <summary>Puts components that were issued but not used back into stock.</summary>
public sealed record ReturnMaterialsCommand(Guid Id, IReadOnlyList<IssueLineInput> Lines)
    : ICommand<ProductionOrderDto>;

/// <summary>
/// Receives the finished goods into stock and closes the order. With
/// <see cref="IssueRemaining"/> the outstanding components are issued first (backflush).
/// </summary>
/// <param name="ScrappedQuantity">Units rejected at inspection: made, but not received into stock.</param>
/// <param name="CostScrapSeparately">Hold the rejects' share of the cost apart instead of loading it onto the good units.</param>
/// <param name="BatchNumber">Batch / lot the finished goods are received under.</param>
/// <param name="ExpiryDate">Expiry of that batch (yyyy-MM-dd).</param>
public sealed record CompleteProductionOrderCommand(
    Guid Id, decimal ProducedQuantity, bool IssueRemaining, decimal ScrappedQuantity = 0, string? QualityNotes = null,
    bool CostScrapSeparately = false, string? BatchNumber = null, string? ExpiryDate = null)
    : ICommand<ProductionOrderDto>;

/// <summary>Records how long a routing step actually took. Allowed until the order is completed.</summary>
public sealed record RecordOperationCommand(Guid Id, Guid OperationId, decimal ActualMinutes)
    : ICommand<ProductionOrderDto>;

/// <summary>Stores the Finance journal entry the client posted for a completed order.</summary>
public sealed record LinkOrderJournalCommand(Guid Id, Guid JournalEntryId, string? JournalEntryNumber) : ICommand;

/// <summary>Stores the purchase request the client raised for this order's shortages.</summary>
public sealed record LinkOrderRequisitionCommand(Guid Id, string RequisitionNumber) : ICommand;

public sealed record CancelProductionOrderCommand(Guid Id) : ICommand<ProductionOrderDto>;

public sealed record DeleteProductionOrderCommand(Guid Id) : ICommand;

public sealed class CreateProductionOrderValidator : AbstractValidator<CreateProductionOrderCommand>
{
    public CreateProductionOrderValidator()
    {
        RuleFor(x => x.BomId).NotEmpty().WithMessage("Choose a bill of materials.");
        RuleFor(x => x.PlannedQuantity).GreaterThan(0).WithMessage("Quantity to produce must be greater than zero.");
        RuleFor(x => x.Reference).MaximumLength(100);
        RuleFor(x => x.Notes).MaximumLength(2000);
    }
}

public sealed class UpdateProductionOrderValidator : AbstractValidator<UpdateProductionOrderCommand>
{
    public UpdateProductionOrderValidator()
    {
        RuleFor(x => x.PlannedQuantity).GreaterThan(0).WithMessage("Quantity to produce must be greater than zero.");
        RuleFor(x => x.Reference).MaximumLength(100);
        RuleFor(x => x.Notes).MaximumLength(2000);
    }
}

public sealed class IssueMaterialsValidator : AbstractValidator<IssueMaterialsCommand>
{
    public IssueMaterialsValidator()
    {
        RuleForEach(x => x.Lines).ChildRules(l =>
        {
            l.RuleFor(x => x.Quantity).GreaterThan(0).WithMessage("Quantity to issue must be greater than zero.");
            l.RuleFor(x => x.BatchNumber).MaximumLength(100);
        });
    }
}

public sealed class ReturnMaterialsValidator : AbstractValidator<ReturnMaterialsCommand>
{
    public ReturnMaterialsValidator()
    {
        RuleFor(x => x.Lines).NotEmpty().WithMessage("Enter a quantity to return.");
        RuleForEach(x => x.Lines).ChildRules(l =>
        {
            l.RuleFor(x => x.Quantity).GreaterThan(0).WithMessage("Quantity to return must be greater than zero.");
            l.RuleFor(x => x.BatchNumber).MaximumLength(100);
        });
    }
}

public sealed class RecordOperationValidator : AbstractValidator<RecordOperationCommand>
{
    public RecordOperationValidator()
    {
        RuleFor(x => x.ActualMinutes).GreaterThanOrEqualTo(0).WithMessage("Time cannot be negative.");
    }
}

public sealed class CompleteProductionOrderValidator : AbstractValidator<CompleteProductionOrderCommand>
{
    public CompleteProductionOrderValidator()
    {
        RuleFor(x => x.ProducedQuantity).GreaterThan(0).WithMessage("Quantity produced must be greater than zero.");
        RuleFor(x => x.ScrappedQuantity).GreaterThanOrEqualTo(0);
        RuleFor(x => x.QualityNotes).MaximumLength(1000);
        RuleFor(x => x.BatchNumber).MaximumLength(100);
        RuleFor(x => x.ExpiryDate).Must(d => string.IsNullOrWhiteSpace(d) || DateTime.TryParse(d, out _))
            .WithMessage("Expiry date is not a valid date.");
    }
}

public sealed class LinkOrderRequisitionValidator : AbstractValidator<LinkOrderRequisitionCommand>
{
    public LinkOrderRequisitionValidator()
    {
        RuleFor(x => x.RequisitionNumber).NotEmpty().MaximumLength(50);
    }
}
