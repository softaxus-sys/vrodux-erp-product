using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.RealEstate.Application.Sales.Commands;
using Softaxis.RealEstate.Infrastructure.Persistence;

namespace Softaxis.RealEstate.Infrastructure.Handlers.Sales;

internal sealed class DeleteSiteVisitHandler(RealEstateDbContext db)
    : ICommandHandler<DeleteSiteVisitCommand>
{
    public async Task<Result> Handle(DeleteSiteVisitCommand cmd, CancellationToken ct)
    {
        var v = await db.SiteVisits.FindAsync([cmd.Id], ct);
        if (v is null)
            return Result.Failure(Error.NotFoundById("SiteVisit", cmd.Id));

        v.Delete();
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
