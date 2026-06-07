using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.POS.Application.DTOs;

namespace Softaxis.POS.Application.Products.Commands.UpdateProduct;

public sealed record UpdateProductCommand(
    Guid     Id,
    string   Name,
    string?  Description,
    string?  SKU,
    string?  Barcode,
    Guid     CategoryId,
    decimal  SalePrice,
    decimal  CostPrice,
    decimal  TaxRate,
    string   Unit,
    decimal  ReorderLevel,
    bool     TrackInventory,
    bool     IsActive,
    string?  ImageUrl) : ICommand<ProductDto>;

public sealed class UpdateProductCommandValidator : AbstractValidator<UpdateProductCommand>
{
    public UpdateProductCommandValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.CategoryId).NotEmpty();
        RuleFor(x => x.SalePrice).GreaterThanOrEqualTo(0);
        RuleFor(x => x.CostPrice).GreaterThanOrEqualTo(0);
        RuleFor(x => x.TaxRate).InclusiveBetween(0, 100);
        RuleFor(x => x.Unit).NotEmpty().MaximumLength(20);
        RuleFor(x => x.ReorderLevel).GreaterThanOrEqualTo(0);
    }
}
