using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Restaurant.Application.ModifierGroups.Commands;
using Softaxis.Restaurant.Application.ModifierGroups.Dtos;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Handlers.ModifierGroups;

internal sealed class CreateModifierGroupHandler(RestaurantDbContext db)
    : ICommandHandler<CreateModifierGroupCommand, ModifierGroupDto>
{
    public async Task<Result<ModifierGroupDto>> Handle(CreateModifierGroupCommand cmd, CancellationToken ct)
    {
        var group = new Domain.Entities.ModifierGroup(cmd.Name.Trim(), cmd.MinSelect, cmd.MaxSelect);
        foreach (var m in cmd.Modifiers)
            group.Modifiers.Add(new Domain.Entities.Modifier(group.Id, m.Name.Trim(), m.PriceDelta, m.SortOrder));

        db.ModifierGroups.Add(group);
        await db.SaveChangesAsync(ct);

        return Result.Success(ModifierGroupMappings.ToDto(group));
    }
}
