using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Restaurant.Application.Menu.Dtos;

namespace Softaxis.Restaurant.Application.Menu.Commands;

/// <summary>PUT /api/restaurant/menu/items/{id}</summary>
public sealed record UpdateMenuItemCommand(
    Guid Id,
    string Name,
    string? Description,
    decimal Price,
    int PrepTimeMinutes,
    string? Allergens,
    bool IsOnlineOrderable
) : ICommand<MenuItemDto>;

public sealed class UpdateMenuItemValidator : AbstractValidator<UpdateMenuItemCommand>
{
    public UpdateMenuItemValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Name is required.")
            .MaximumLength(200).WithMessage("Name must be ≤ 200 characters.");

        RuleFor(x => x.Price).GreaterThanOrEqualTo(0).WithMessage("Price cannot be negative.");

        RuleFor(x => x.Description)
            .MaximumLength(1000).WithMessage("Description must be ≤ 1000 characters.")
            .When(x => x.Description is not null);

        RuleFor(x => x.Allergens)
            .MaximumLength(500).WithMessage("Allergens must be ≤ 500 characters.")
            .When(x => x.Allergens is not null);
    }
}
