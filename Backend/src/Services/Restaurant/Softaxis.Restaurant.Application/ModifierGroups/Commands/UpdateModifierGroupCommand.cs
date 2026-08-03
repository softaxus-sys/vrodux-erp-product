using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Restaurant.Application.ModifierGroups.Dtos;

namespace Softaxis.Restaurant.Application.ModifierGroups.Commands;

/// <summary>
/// PUT /api/restaurant/modifier-groups/{id} — replaces the group's own fields and diffs the modifier
/// list: entries with an Id are updated in place, entries without one are added, and any existing
/// modifier not present in the submitted list is soft-deleted.
/// </summary>
public sealed record UpdateModifierGroupCommand(
    Guid Id,
    string Name,
    int MinSelect,
    int MaxSelect,
    IReadOnlyList<ModifierInput> Modifiers
) : ICommand<ModifierGroupDto>;

public sealed class UpdateModifierGroupValidator : AbstractValidator<UpdateModifierGroupCommand>
{
    public UpdateModifierGroupValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Name is required.")
            .MaximumLength(100).WithMessage("Name must be ≤ 100 characters.");

        RuleFor(x => x.MinSelect).GreaterThanOrEqualTo(0).WithMessage("Minimum selections cannot be negative.");
        RuleFor(x => x.MaxSelect).GreaterThanOrEqualTo(1).WithMessage("Maximum selections must be at least 1.");
        RuleFor(x => x)
            .Must(x => x.MaxSelect >= x.MinSelect)
            .WithMessage("Maximum selections cannot be less than the minimum.");

        RuleForEach(x => x.Modifiers).ChildRules(m =>
        {
            m.RuleFor(i => i.Name).NotEmpty().WithMessage("Modifier name is required.");
        });
    }
}
