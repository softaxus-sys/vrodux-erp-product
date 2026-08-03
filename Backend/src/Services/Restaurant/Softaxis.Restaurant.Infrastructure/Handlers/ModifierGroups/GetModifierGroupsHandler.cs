using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Restaurant.Application.ModifierGroups.Dtos;
using Softaxis.Restaurant.Application.ModifierGroups.Queries;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Handlers.ModifierGroups;

internal sealed class GetModifierGroupsHandler(RestaurantDbContext db)
    : IQueryHandler<GetModifierGroupsQuery, IReadOnlyList<ModifierGroupDto>>
{
    public async Task<Result<IReadOnlyList<ModifierGroupDto>>> Handle(GetModifierGroupsQuery query, CancellationToken ct)
    {
        var groups = await db.ModifierGroups.AsNoTracking().Include(g => g.Modifiers)
            .Where(g => !g.IsDeleted).OrderBy(g => g.Name).ToListAsync(ct);

        return Result.Success<IReadOnlyList<ModifierGroupDto>>(groups.Select(ModifierGroupMappings.ToDto).ToList());
    }
}
