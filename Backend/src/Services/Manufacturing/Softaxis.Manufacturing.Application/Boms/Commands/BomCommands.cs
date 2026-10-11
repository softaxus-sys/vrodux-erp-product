using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Manufacturing.Application.Boms.Dtos;

namespace Softaxis.Manufacturing.Application.Boms.Commands;

/// <summary>One component of a BOM. Name, SKU and cost are read from Inventory, not trusted from the client.</summary>
public sealed record BomLineInput(Guid ComponentProductId, decimal Quantity, string? Unit, decimal ScrapPercent);

/// <summary>One routing step. Rates are read from the work centre, not sent by the client.</summary>
public sealed record BomOperationInput(string Name, Guid WorkCentreId, decimal SetupMinutes, decimal RunMinutesPerBatch);

/// <summary>Something the BOM yields besides its main product. Quantity is per batch.</summary>
public sealed record BomByProductInput(Guid ProductId, decimal Quantity);

public sealed record CreateBomCommand(
    string Name, Guid ProductId, decimal OutputQuantity, string? Unit, string? Notes,
    IReadOnlyList<BomLineInput> Lines, IReadOnlyList<BomOperationInput>? Operations = null,
    IReadOnlyList<BomByProductInput>? ByProducts = null) : ICommand<BomDto>;

public sealed record UpdateBomCommand(
    Guid Id, string Name, Guid ProductId, decimal OutputQuantity, string? Unit, string? Notes,
    IReadOnlyList<BomLineInput> Lines, IReadOnlyList<BomOperationInput>? Operations = null,
    IReadOnlyList<BomByProductInput>? ByProducts = null) : ICommand<BomDto>;

public sealed record SetBomStatusCommand(Guid Id, string Status) : ICommand;

public sealed record DeleteBomCommand(Guid Id) : ICommand;

public sealed class CreateBomValidator : AbstractValidator<CreateBomCommand>
{
    public CreateBomValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.ProductId).NotEmpty().WithMessage("Choose the finished product.");
        RuleFor(x => x.OutputQuantity).GreaterThan(0).WithMessage("Batch quantity must be greater than zero.");
        RuleFor(x => x.Lines).NotEmpty().WithMessage("Add at least one component.");
        RuleForEach(x => x.Lines).SetValidator(new BomLineInputValidator());
        RuleForEach(x => x.Operations).SetValidator(new BomOperationInputValidator());
    }
}

public sealed class UpdateBomValidator : AbstractValidator<UpdateBomCommand>
{
    public UpdateBomValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.ProductId).NotEmpty().WithMessage("Choose the finished product.");
        RuleFor(x => x.OutputQuantity).GreaterThan(0).WithMessage("Batch quantity must be greater than zero.");
        RuleFor(x => x.Lines).NotEmpty().WithMessage("Add at least one component.");
        RuleForEach(x => x.Lines).SetValidator(new BomLineInputValidator());
        RuleForEach(x => x.Operations).SetValidator(new BomOperationInputValidator());
    }
}

public sealed class BomOperationInputValidator : AbstractValidator<BomOperationInput>
{
    public BomOperationInputValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200).WithMessage("Each operation needs a name.");
        RuleFor(x => x.WorkCentreId).NotEmpty().WithMessage("Choose a work centre for each operation.");
        RuleFor(x => x.SetupMinutes).GreaterThanOrEqualTo(0);
        RuleFor(x => x.RunMinutesPerBatch).GreaterThanOrEqualTo(0);
    }
}

public sealed class BomLineInputValidator : AbstractValidator<BomLineInput>
{
    public BomLineInputValidator()
    {
        RuleFor(x => x.ComponentProductId).NotEmpty();
        RuleFor(x => x.Quantity).GreaterThan(0).WithMessage("Component quantity must be greater than zero.");
        RuleFor(x => x.ScrapPercent).InclusiveBetween(0, 100);
    }
}
