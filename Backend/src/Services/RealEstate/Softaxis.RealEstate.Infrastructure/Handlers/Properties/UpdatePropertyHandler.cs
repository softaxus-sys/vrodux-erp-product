using Microsoft.EntityFrameworkCore;
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

        // Only when the caller actually sent it. A null means "leave as is", so a form that does
        // not know about this field cannot silently unpublish the property.
        if (cmd.ListOnWebsite.HasValue && cmd.ListOnWebsite.Value != p.ListOnWebsite)
        {
            if (cmd.ListOnWebsite.Value)
            {
                var hasImage = await db.PropertyImages
                    .AnyAsync(i => i.PropertyId == p.Id && !i.IsDeleted, ct);
                if (!hasImage)
                    return Result.Failure<PropertyDto>(Error.Custom("Property.NoImages",
                        "Add at least one photo before listing this property on the website."));
            }
            p.SetWebsiteListing(cmd.ListOnWebsite.Value);
        }

        await db.SaveChangesAsync(ct);

        var images = await PropertyMappings.LoadImagesAsync(db, [p.Id], ct);
        return Result.Success(PropertyMappings.ToDto(p, images.GetValueOrDefault(p.Id, [])));
    }
}
