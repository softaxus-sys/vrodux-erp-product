using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Restaurant.Application.Menu.Dtos;

namespace Softaxis.Restaurant.Application.Menu.Commands;

/// <summary>POST /api/restaurant/menu/categories</summary>
public sealed record CreateMenuCategoryCommand(
    string Name,
    string? Description,
    int SortOrder,
    Guid? KitchenStationId = null
) : ICommand<MenuCategoryDto>;

public sealed class CreateMenuCategoryValidator : AbstractValidator<CreateMenuCategoryCommand>
{
    public CreateMenuCategoryValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Name is required.")
            .MaximumLength(100).WithMessage("Name must be ≤ 100 characters.");

        RuleFor(x => x.Description)
            .MaximumLength(500).WithMessage("Description must be ≤ 500 characters.")
            .When(x => x.Description is not null);
    }
}
