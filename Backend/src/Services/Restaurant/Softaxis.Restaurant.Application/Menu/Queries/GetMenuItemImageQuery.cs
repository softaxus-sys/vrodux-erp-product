using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Restaurant.Application.Menu.Dtos;

namespace Softaxis.Restaurant.Application.Menu.Queries;

public sealed record GetMenuItemImageQuery(Guid MenuItemId, Guid ImageId) : IQuery<MenuItemImageFileDto>;
