using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.RealEstate.Application.Abstractions;
using Softaxis.RealEstate.Application.Properties.Commands;
using Softaxis.RealEstate.Infrastructure.Persistence;
using Softaxis.RealEstate.Infrastructure.Services;

namespace Softaxis.RealEstate.Infrastructure.Handlers.Properties;

internal sealed class DeletePropertyHandler(RealEstateDbContext db, ICurrentUser user)
    : ICommandHandler<DeletePropertyCommand>
{
    public async Task<Result> Handle(DeletePropertyCommand cmd, CancellationToken ct)
    {
        var p = await db.Properties.FirstOrDefaultAsync(x => x.Id == cmd.Id && !x.IsDeleted, ct);
        if (p is null)
            return Result.Failure(Error.NotFoundById("Property", cmd.Id));

        // Removing a building removes every listing in it, so it must not be a way round the
        // per-listing ownership rule: anyone but an administrator may only delete a building whose
        // listings are all their own.
        if (!ListingConfidentiality.CanViewAll(user))
        {
            var me = user.Id;
            var othersListings = await db.PropertyUnits.AsNoTracking()
                .AnyAsync(u => u.PropertyId == cmd.Id && !u.IsDeleted && (u.AgentUserId == null || u.AgentUserId != me), ct);
            if (othersListings)
                return Result.Failure(Error.Custom("Listing.Forbidden",
                    "This building has listings that belong to other agents. Only an administrator can delete it."));
        }

        p.Delete();
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
