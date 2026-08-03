using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Restaurant.Application.ModifierGroups.Commands;
using Softaxis.Restaurant.Application.ModifierGroups.Dtos;
using Softaxis.Restaurant.Domain.Entities;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Handlers.ModifierGroups;

internal sealed class UpdateModifierGroupHandler(RestaurantDbContext db)
    : ICommandHandler<UpdateModifierGroupCommand, ModifierGroupDto>
{
    public async Task<Result<ModifierGroupDto>> Handle(UpdateModifierGroupCommand cmd, CancellationToken ct)
    {
        var group = await db.ModifierGroups.Include(g => g.Modifiers)
            .FirstOrDefaultAsync(g => g.Id == cmd.Id && !g.IsDeleted, ct);
        if (group is null)
            return Result.Failure<ModifierGroupDto>(Error.NotFoundById("ModifierGroup", cmd.Id));

        group.Update(cmd.Name.Trim(), cmd.MinSelect, cmd.MaxSelect);

        // Diff-and-replace: keep/update modifiers whose Id was submitted, soft-delete the rest,
        // add any with no Id as brand new.
        var incomingIds = cmd.Modifiers.Where(m => m.Id.HasValue).Select(m => m.Id!.Value).ToHashSet();
        foreach (var existing in group.Modifiers.Where(m => !m.IsDeleted && !incomingIds.Contains(m.Id)))
            existing.Delete();

        foreach (var input in cmd.Modifiers)
        {
            if (input.Id is { } id)
            {
                var existing = group.Modifiers.FirstOrDefault(m => m.Id == id);
                existing?.Update(input.Name.Trim(), input.PriceDelta, input.SortOrder, input.IsActive);
            }
            else
            {
                group.Modifiers.Add(new Modifier(group.Id, input.Name.Trim(), input.PriceDelta, input.SortOrder));
            }
        }

        await db.SaveChangesAsync(ct);

        return Result.Success(ModifierGroupMappings.ToDto(group));
    }
}
