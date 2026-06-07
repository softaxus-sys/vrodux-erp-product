using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.POS.Application.DTOs;

namespace Softaxis.POS.Application.Products.Commands.AdjustStock;

public sealed record AdjustStockCommand(
    Guid    ProductId,
    decimal Quantity,
    string  AdjustmentType,
    string? Reference,
    string? Notes) : ICommand<StockMovementDto>;

public sealed class AdjustStockCommandValidator : AbstractValidator<AdjustStockCommand>
{
    public AdjustStockCommandValidator()
    {
        RuleFor(x => x.ProductId).NotEmpty();
        RuleFor(x => x.Quantity).NotEqual(0).WithMessage("Adjustment quantity cannot be zero.");
        RuleFor(x => x.AdjustmentType).NotEmpty();
    }
}
