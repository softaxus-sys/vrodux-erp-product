using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Restaurant.Application.Menu.Dtos;

namespace Softaxis.Restaurant.Application.Menu.Queries;

/// <summary>GET /api/restaurant/menu/branch-settings?branchId= — every item a branch prices or sells differently.</summary>
public sealed record GetMenuBranchSettingsQuery(Guid BranchId) : IQuery<IReadOnlyList<MenuItemBranchSettingDto>>;
