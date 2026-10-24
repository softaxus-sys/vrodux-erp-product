using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Restaurant.Application.Menu.Dtos;

namespace Softaxis.Restaurant.Application.Menu.Commands;

/// <summary>
/// Sets one branch's price and availability for one item. A null price with IsAvailable = true
/// clears the override, so the branch goes back to the shared menu.
/// </summary>
public sealed record SetMenuItemBranchSettingCommand(Guid MenuItemId, Guid BranchId, decimal? PriceOverride, bool IsAvailable)
    : ICommand<MenuItemBranchSettingDto>;

public sealed class SetMenuItemBranchSettingCommandValidator : AbstractValidator<SetMenuItemBranchSettingCommand>
{
    public SetMenuItemBranchSettingCommandValidator()
    {
        RuleFor(x => x.MenuItemId).NotEmpty();
        RuleFor(x => x.BranchId).NotEmpty();
        RuleFor(x => x.PriceOverride).GreaterThanOrEqualTo(0).When(x => x.PriceOverride.HasValue)
            .WithMessage("Branch price cannot be negative.");
    }
}
