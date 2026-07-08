using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.VisaServices.Application.VisaCases.Dtos;
using Softaxis.VisaServices.Application.VisaCases.Queries;
using Softaxis.VisaServices.Infrastructure.Persistence;
using Softaxis.VisaServices.Infrastructure.Persistence.Seed;

namespace Softaxis.VisaServices.Infrastructure.Handlers.VisaCases;

internal sealed class GetVisaTypesHandler(VisaDbContext db)
    : IQueryHandler<GetVisaTypesQuery, IReadOnlyList<VisaTypeDto>>
{
    public async Task<Result<IReadOnlyList<VisaTypeDto>>> Handle(GetVisaTypesQuery query, CancellationToken ct)
    {
        // Lazy per-tenant seed: the first time a tenant opens the module, give it its own
        // editable copy of the default UAE catalogue (TenantId stamped on save).
        if (!await db.VisaTypes.AnyAsync(ct))
        {
            db.VisaTypes.AddRange(VisaTypeCatalogue.BuildDefaults());
            await db.SaveChangesAsync(ct);
        }

        var items = await db.VisaTypes.AsNoTracking()
            .Where(t => t.IsActive)
            .OrderBy(t => t.Category).ThenBy(t => t.Name).ToListAsync(ct);

        return Result.Success<IReadOnlyList<VisaTypeDto>>(items.Select(VisaCaseMappings.ToDto).ToList());
    }
}
