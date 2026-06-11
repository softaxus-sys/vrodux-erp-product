using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.RealEstate.Application.Sales.Commands;
using Softaxis.RealEstate.Application.Sales.Dtos;
using Softaxis.RealEstate.Domain.Entities;
using Softaxis.RealEstate.Infrastructure.Persistence;

namespace Softaxis.RealEstate.Infrastructure.Handlers.Sales;

internal sealed class CreateSiteVisitHandler(RealEstateDbContext db)
    : ICommandHandler<CreateSiteVisitCommand, SiteVisitDto>
{
    public async Task<Result<SiteVisitDto>> Handle(CreateSiteVisitCommand cmd, CancellationToken ct)
    {
        var v = new SiteVisit(cmd.LeadId, cmd.CustomerId, cmd.CustomerName, cmd.PropertyId, cmd.UnitId,
            cmd.ScheduledAt, cmd.AssignedTo ?? "", cmd.Notes);

        db.SiteVisits.Add(v);
        await db.SaveChangesAsync(ct);

        return Result.Success(SalesMappings.ToDto(v));
    }
}
