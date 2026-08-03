using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Restaurant.Application.Combos.Dtos;

namespace Softaxis.Restaurant.Application.Combos.Commands;

public sealed record ComboItemInput(Guid? MenuItemId, Guid? CategoryId, int Quantity, int SortOrder);

/// <summary>POST /api/restaurant/combos</summary>
public sealed record CreateComboCommand(string Name, decimal Price, IReadOnlyList<ComboItemInput> Items) : ICommand<ComboDto>;

/// <summary>PUT /api/restaurant/combos/{id} — diff-and-replace: the submitted item set fully replaces the existing one.</summary>
public sealed record UpdateComboCommand(Guid Id, string Name, decimal Price, bool IsActive, IReadOnlyList<ComboItemInput> Items) : ICommand<ComboDto>;

public sealed record DeleteComboCommand(Guid Id) : ICommand;

public sealed class ComboItemInputValidator : AbstractValidator<ComboItemInput>
{
    public ComboItemInputValidator()
    {
        RuleFor(x => x.Quantity).GreaterThan(0);
        RuleFor(x => x).Must(x => x.MenuItemId.HasValue ^ x.CategoryId.HasValue)
            .WithMessage("Each combo slot must set exactly one of MenuItemId (fixed) or CategoryId (choose-one).");
    }
}

public sealed class CreateComboValidator : AbstractValidator<CreateComboCommand>
{
    public CreateComboValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Price).GreaterThanOrEqualTo(0);
        RuleFor(x => x.Items).NotEmpty().WithMessage("A combo needs at least one item slot.");
        RuleForEach(x => x.Items).SetValidator(new ComboItemInputValidator());
    }
}

public sealed class UpdateComboValidator : AbstractValidator<UpdateComboCommand>
{
    public UpdateComboValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Price).GreaterThanOrEqualTo(0);
        RuleFor(x => x.Items).NotEmpty().WithMessage("A combo needs at least one item slot.");
        RuleForEach(x => x.Items).SetValidator(new ComboItemInputValidator());
    }
}
