using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.RealEstate.Application.Properties.Dtos;

namespace Softaxis.RealEstate.Application.Properties.Commands;

public sealed record CreatePropertyCommand(
    string Name, string PropertyType, string? Address, string? City, string Emirate,
    decimal TotalArea, int TotalUnits, decimal MarketValue, string? Developer, string? Description)
    : ICommand<PropertyDto>;

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
    decimal TotalArea, int TotalUnits, decimal MarketValue, string? Developer, string? Description)
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
