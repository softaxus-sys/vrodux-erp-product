using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.RealEstate.Application.Properties.Dtos;

namespace Softaxis.RealEstate.Application.Properties.Commands;

public sealed record CreatePropertyCommand(
    string Name, string PropertyType, string? Address, string? City, string Emirate,
    decimal TotalArea, int TotalUnits, decimal MarketValue, string? Developer, string? Description)
    : ICommand<PropertyDto>;

// NOTE: creation deliberately has no ListOnWebsite. A brand-new property has no photographs, so
// publishing it at that moment could only ever produce an empty listing. The client creates the
// property, uploads photos, then publishes — which is the path the image guard protects.

public sealed class CreatePropertyValidator : AbstractValidator<CreatePropertyCommand>
{
    public CreatePropertyValidator()
    {
        RuleFor(x => x.Name).NotEmpty().WithMessage("Property name is required.");
        RuleFor(x => x.PropertyType).NotEmpty();
        RuleFor(x => x.Emirate).NotEmpty();
    }
}

public sealed record UpdatePropertyCommand(
    Guid Id, string Name, string PropertyType, string? Address, string? City, string Emirate,
    decimal TotalArea, int TotalUnits, decimal MarketValue, string? Developer, string? Description,
    /// <summary>
    /// Null leaves the current setting alone. The edit form is a full replace, so a plain bool
    /// would silently unpublish every property saved by a caller that does not send the field —
    /// the same trap that wiped four property fields before Module 53e.
    /// </summary>
    bool? ListOnWebsite = null)
    : ICommand<PropertyDto>;

public sealed class UpdatePropertyValidator : AbstractValidator<UpdatePropertyCommand>
{
    public UpdatePropertyValidator()
    {
        RuleFor(x => x.Name).NotEmpty().WithMessage("Property name is required.");
        RuleFor(x => x.PropertyType).NotEmpty();
        RuleFor(x => x.Emirate).NotEmpty();
    }
}

public sealed record DeletePropertyCommand(Guid Id) : ICommand;
