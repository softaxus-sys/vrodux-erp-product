using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.RealEstate.Application.Properties.Dtos;
using Softaxis.RealEstate.Application.Properties.Queries;
using Softaxis.RealEstate.Infrastructure.Persistence;

namespace Softaxis.RealEstate.Infrastructure.Handlers.Properties;

internal sealed class GetPropertiesHandler(RealEstateDbContext db)
    : IQueryHandler<GetPropertiesQuery, PagedResult<PropertyDto>>
{
    /// <summary>Capped so a hand-edited pageSize cannot ask for the whole set back.</summary>
    private const int MaxPageSize = 200;

    public async Task<Result<PagedResult<PropertyDto>>> Handle(GetPropertiesQuery query, CancellationToken ct)
    {
        var page     = Math.Max(1, query.Page);
        var pageSize = Math.Clamp(query.PageSize, 1, MaxPageSize);

        // The tenant filter replaces any entity-level soft-delete filter, so !IsDeleted is manual.
        var q = db.Properties.AsNoTracking().Include(x => x.Units)
            .Where(x => !x.IsDeleted);

        if (!string.IsNullOrWhiteSpace(query.Status))
            q = q.Where(x => x.Status == query.Status);

        if (!string.IsNullOrWhiteSpace(query.PropertyType))
            q = q.Where(x => x.PropertyType == query.PropertyType);

        if (!string.IsNullOrWhiteSpace(query.Search))
            q = q.Where(x => x.Name.Contains(query.Search)
                          || x.Address.Contains(query.Search)
                          || x.PropertyNumber.Contains(query.Search));

        // Counted before paging so the caller knows how many pages exist.
        var total = await q.CountAsync(ct);

        var items = await q
            .OrderBy(x => x.Name).ThenBy(x => x.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        return Result.Success(PagedResult<PropertyDto>.Create(
            items.Select(PropertyMappings.ToDto).ToList(), total, page, pageSize));
    }
}
