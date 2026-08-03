using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Restaurant.Application.Combos.Dtos;

namespace Softaxis.Restaurant.Application.Combos.Queries;

/// <summary>GET /api/restaurant/combos?activeOnly= — activeOnly=true for the order-taking picker.</summary>
public sealed record GetCombosQuery(bool ActiveOnly = false) : IQuery<IReadOnlyList<ComboDto>>;
