using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.RealEstate.Application.Units.Dtos;

namespace Softaxis.RealEstate.Application.Units.Commands;

/// <summary>
/// UnitsController was read-only, so the frontend's `createUnit` / `deleteUnit` called endpoints
/// that did not exist and Add Unit was dead UI.
/// </summary>
public sealed record CreateUnitCommand(
    Guid PropertyId, string UnitNumber, string UnitType,
    decimal Area, int Floor, decimal RentPerYear, decimal SalePrice,
    string? Furnishing = null, string? View = null, int? Bedrooms = null, int? Bathrooms = null,
    int Parking = 0, decimal ServiceCharge = 0, string? Notes = null) : ICommand<UnitDto>;

public sealed class CreateUnitValidator : AbstractValidator<CreateUnitCommand>
{
    public CreateUnitValidator()
    {
        RuleFor(x => x.PropertyId).NotEmpty().WithMessage("Choose the property this unit belongs to.");
        RuleFor(x => x.UnitNumber).NotEmpty().WithMessage("Unit number is required.").MaximumLength(50);
        RuleFor(x => x.UnitType).NotEmpty().WithMessage("Unit type is required.").MaximumLength(50);
        RuleFor(x => x.Area).GreaterThanOrEqualTo(0);
        RuleFor(x => x.Floor).GreaterThanOrEqualTo(0);
        RuleFor(x => x.RentPerYear).GreaterThanOrEqualTo(0);
        RuleFor(x => x.SalePrice).GreaterThanOrEqualTo(0);
    }
}

public sealed record UpdateUnitCommand(
    Guid Id, string UnitNumber, string UnitType,
    decimal Area, int Floor, decimal RentPerYear, decimal SalePrice,
    string? Furnishing = null, string? View = null, int? Bedrooms = null, int? Bathrooms = null,
    int Parking = 0, decimal ServiceCharge = 0, string? Notes = null) : ICommand;

public sealed class UpdateUnitValidator : AbstractValidator<UpdateUnitCommand>
{
    public UpdateUnitValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
        RuleFor(x => x.UnitNumber).NotEmpty().WithMessage("Unit number is required.").MaximumLength(50);
        RuleFor(x => x.UnitType).NotEmpty().WithMessage("Unit type is required.").MaximumLength(50);
    }
}

public sealed record DeleteUnitCommand(Guid Id) : ICommand;
