using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Deals.Dtos;
using Softaxis.CRM.Application.Deals.Queries;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Deals;

internal sealed class GetDealByIdHandler(CrmDbContext db) : IQueryHandler<GetDealByIdQuery, DealDto>
{
    public async Task<Result<DealDto>> Handle(GetDealByIdQuery query, CancellationToken ct)
    {
        var d = await db.Deals.AsNoTracking().FirstOrDefaultAsync(x => x.Id == query.Id, ct);
        if (d is null)
            return Result.Failure<DealDto>(Error.NotFoundById("Deal", query.Id));

        return Result.Success(DealMappings.ToDto(d));
    }
}
