using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Restaurant.Application.ModifierGroups.Dtos;

namespace Softaxis.Restaurant.Application.ModifierGroups.Commands;

/// <summary>POST /api/restaurant/modifier-groups</summary>
public sealed record CreateModifierGroupCommand(
    string Name,
    int MinSelect,
    int MaxSelect,
    IReadOnlyList<ModifierInput> Modifiers
) : ICommand<ModifierGroupDto>;

public sealed class CreateModifierGroupValidator : AbstractValidator<CreateModifierGroupCommand>
{
    public CreateModifierGroupValidator()
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
