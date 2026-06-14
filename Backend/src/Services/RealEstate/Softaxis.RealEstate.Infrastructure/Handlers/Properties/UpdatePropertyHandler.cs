using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.RealEstate.Application.Properties.Commands;
using Softaxis.RealEstate.Application.Properties.Dtos;
using Softaxis.RealEstate.Infrastructure.Persistence;

namespace Softaxis.RealEstate.Infrastructure.Handlers.Properties;

internal sealed class UpdatePropertyHandler(RealEstateDbContext db)
    : ICommandHandler<UpdatePropertyCommand, PropertyDto>
{
    public async Task<Result<PropertyDto>> Handle(UpdatePropertyCommand cmd, CancellationToken ct)
    {
        var p = await db.Properties.FindAsync([cmd.Id], ct);
        if (p is null || p.IsDeleted)
            return Result.Failure<PropertyDto>(Error.NotFoundById("Property", cmd.Id));

        p.Update(cmd.Name.Trim(), cmd.PropertyType, cmd.Address ?? "", cmd.City ?? "",
            cmd.Emirate ?? "", cmd.TotalArea, cmd.TotalUnits, cmd.MarketValue, cmd.Developer, cmd.Description);

        await db.SaveChangesAsync(ct);

        return Result.Success(PropertyMappings.ToDto(p));
    }
}
