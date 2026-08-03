using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Restaurant.Application.ModifierGroups.Dtos;

namespace Softaxis.Restaurant.Application.ModifierGroups.Queries;

/// <summary>GET /api/restaurant/modifier-groups — the full catalogue (admin view).</summary>
public sealed record GetModifierGroupsQuery : IQuery<IReadOnlyList<ModifierGroupDto>>;
