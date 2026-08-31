using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.RealEstate.Application.Units.Dtos;
using Softaxis.RealEstate.Application.Units.Queries;
using Softaxis.RealEstate.Infrastructure.Persistence;

namespace Softaxis.RealEstate.Infrastructure.Handlers.Units;

internal sealed class GetUnitsHandler(RealEstateDbContext db)
    : IQueryHandler<GetUnitsQuery, PagedResult<UnitDto>>
{
    /// <summary>Capped so a hand-edited pageSize cannot ask for the whole set back.</summary>
    private const int MaxPageSize = 200;

    public async Task<Result<PagedResult<UnitDto>>> Handle(GetUnitsQuery query, CancellationToken ct)
    {
        var page     = Math.Max(1, query.Page);
        var pageSize = Math.Clamp(query.PageSize, 1, MaxPageSize);

        // The tenant filter replaces any entity-level soft-delete filter, so !IsDeleted is manual.
        var q = db.PropertyUnits.AsNoTracking()
            .Where(x => !x.IsDeleted);

        if (!string.IsNullOrWhiteSpace(query.Status))
            q = q.Where(x => x.Status == query.Status);

        if (query.PropertyId.HasValue)
            q = q.Where(x => x.PropertyId == query.PropertyId.Value);

        if (!string.IsNullOrWhiteSpace(query.Search))
            q = q.Where(x => x.UnitNumber.Contains(query.Search) || x.UnitType.Contains(query.Search));

        // Counted before paging so the caller knows how many pages exist.
        var total = await q.CountAsync(ct);

        var items = await q
            .OrderBy(x => x.UnitNumber).ThenBy(x => x.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return Result.Success(PagedResult<UnitDto>.Create(
            items.Select(UnitMappings.ToDto).ToList(), total, page, pageSize));
    }
}
