using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.RealEstate.Application.Properties.Commands;
using Softaxis.RealEstate.Application.Properties.Dtos;
using Softaxis.RealEstate.Domain.Entities;
using Softaxis.RealEstate.Infrastructure.Persistence;

namespace Softaxis.RealEstate.Infrastructure.Handlers.Properties;

internal sealed class CreatePropertyHandler(RealEstateDbContext db)
    : ICommandHandler<CreatePropertyCommand, PropertyDto>
{
    public async Task<Result<PropertyDto>> Handle(CreatePropertyCommand cmd, CancellationToken ct)
    {
        var p = new Property(cmd.Name.Trim(), cmd.PropertyType, cmd.Address ?? "", cmd.City ?? "",
            cmd.Emirate ?? "", cmd.TotalArea, cmd.TotalUnits, cmd.MarketValue, cmd.Developer, cmd.Description);

        db.Properties.Add(p);
        await db.SaveChangesAsync(ct);

        return Result.Success(PropertyMappings.ToDto(p));
    }
}
