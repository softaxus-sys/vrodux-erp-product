using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Construction.Application.Boqs.Dtos;
using Softaxis.Construction.Application.Boqs.Queries;
using Softaxis.Construction.Infrastructure.Persistence;

namespace Softaxis.Construction.Infrastructure.Handlers.Boqs;

internal sealed class GetBoqsHandler(ConstructionDbContext db)
    : IQueryHandler<GetBoqsQuery, IReadOnlyList<BoqDto>>
{
    public async Task<Result<IReadOnlyList<BoqDto>>> Handle(GetBoqsQuery query, CancellationToken ct)
    {
        var list = await db.BOQs.AsNoTracking().Include(x => x.Items)
            .Where(x => !x.IsDeleted).OrderByDescending(x => x.CreatedAt).ToListAsync(ct);

        return Result.Success<IReadOnlyList<BoqDto>>(list.Select(BoqMappings.ToDto).ToList());
    }
}
