using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Restaurant.Application.Menu.Commands;

/// <summary>DELETE /api/restaurant/menu/categories/{id} — rejected (409) while the category still
/// has non-deleted items; delete or move those first.</summary>
public sealed record DeleteMenuCategoryCommand(Guid Id) : ICommand;
