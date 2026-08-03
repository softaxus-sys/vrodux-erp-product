using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Restaurant.Application.Menu.Dtos;

namespace Softaxis.Restaurant.Application.Menu.Commands;

/// <summary>POST /api/restaurant/menu/items</summary>
public sealed record CreateMenuItemCommand(
    Guid CategoryId,
    string Name,
    string? Description,
    decimal Price,
    int PrepTimeMinutes,
    string? Allergens,
    Guid? KitchenStationId = null
) : ICommand<MenuItemDto>;

public sealed class CreateMenuItemValidator : AbstractValidator<CreateMenuItemCommand>
{
    public CreateMenuItemValidator()
    {
        RuleFor(x => x.CategoryId).NotEmpty().WithMessage("Category is required.");

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
