using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Restaurant.Application.Menu.Dtos;

namespace Softaxis.Restaurant.Application.Menu.Commands;

/// <summary>PUT /api/restaurant/menu/categories/{id}</summary>
public sealed record UpdateMenuCategoryCommand(
    Guid Id,
    string Name,
    string? Description,
    int SortOrder
) : ICommand<MenuCategoryDto>;

public sealed class UpdateMenuCategoryValidator : AbstractValidator<UpdateMenuCategoryCommand>
{
    public UpdateMenuCategoryValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Name is required.")
            .MaximumLength(100).WithMessage("Name must be ≤ 100 characters.");

        RuleFor(x => x.Description)
            .MaximumLength(500).WithMessage("Description must be ≤ 500 characters.")
            .When(x => x.Description is not null);
    }
}
