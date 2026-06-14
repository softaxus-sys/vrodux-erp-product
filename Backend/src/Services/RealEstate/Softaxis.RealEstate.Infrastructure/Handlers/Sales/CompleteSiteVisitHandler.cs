using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.RealEstate.Application.Sales.Commands;
using Softaxis.RealEstate.Infrastructure.Persistence;

namespace Softaxis.RealEstate.Infrastructure.Handlers.Sales;

internal sealed class CompleteSiteVisitHandler(RealEstateDbContext db)
    : ICommandHandler<CompleteSiteVisitCommand>
{
    public async Task<Result> Handle(CompleteSiteVisitCommand cmd, CancellationToken ct)
    {
        var v = await db.SiteVisits.FindAsync([cmd.Id], ct);
        if (v is null)
            return Result.Failure(Error.NotFoundById("SiteVisit", cmd.Id));

        v.Complete(cmd.Feedback);
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
