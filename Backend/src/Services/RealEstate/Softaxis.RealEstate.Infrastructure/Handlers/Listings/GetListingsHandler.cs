using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.RealEstate.Application.Listings.Dtos;
using Softaxis.RealEstate.Application.Listings.Queries;
using Softaxis.RealEstate.Domain.Entities;
using Softaxis.RealEstate.Infrastructure.Persistence;

namespace Softaxis.RealEstate.Infrastructure.Handlers.Listings;

internal sealed class GetListingsHandler(RealEstateDbContext db)
    : IQueryHandler<GetListingsQuery, PagedResult<ListingDto>>
{
    /// <summary>Capped so a hand-edited pageSize cannot ask for the whole set back.</summary>
    private const int MaxPageSize = 200;

    public async Task<Result<PagedResult<ListingDto>>> Handle(GetListingsQuery query, CancellationToken ct)
    {
        var page     = Math.Max(1, query.Page);
        var pageSize = Math.Clamp(query.PageSize, 1, MaxPageSize);

        var q = Build(db, query);

        // Counted before paging so the caller knows how many pages exist.
        var total = await q.CountAsync(ct);

        var rows = await q
            // Newest listings first: an agency works the top of the sheet. Undated rows sort last
            // rather than first — SQL Server would otherwise lead the page with them — and fall
            // back to the building so they still group sensibly.
            .OrderBy(x => x.Unit.ListedOn == null)
            .ThenByDescending(x => x.Unit.ListedOn)
            .ThenBy(x => x.Property.Name).ThenBy(x => x.Unit.UnitNumber)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        // One extra query for the whole page, never one per row.
        var galleries = await ListingMappings.LoadGalleriesAsync(
            db, rows.Select(r => r.Property.Id).Distinct().ToList(), ct);

        var items = rows
            .Select(r => ListingMappings.ToDto(
                r.Unit, r.Property, galleries.GetValueOrDefault(r.Property.Id, default)))
            .ToList();

        return Result.Success(PagedResult<ListingDto>.Create(items, total, page, pageSize));
    }

    /// <summary>
    /// The filtered unit-to-building join, shared with the summary so the tiles can never describe
    /// a different set of rows than the table beneath them.
    /// </summary>
    internal static IQueryable<UnitWithProperty> Build(RealEstateDbContext db, GetListingsQuery query)
    {
        // The tenant filter replaces any entity-level soft-delete filter, so !IsDeleted is manual
        // on BOTH sides — a unit in a deleted building is not a listing.
        var q = from u in db.PropertyUnits.AsNoTracking().Where(x => !x.IsDeleted)
                join p in db.Properties.AsNoTracking().Where(x => !x.IsDeleted)
                    on u.PropertyId equals p.Id
                select new UnitWithProperty { Unit = u, Property = p };

        if (!string.IsNullOrWhiteSpace(query.Purpose))
            q = q.Where(x => x.Unit.Purpose == query.Purpose);

        if (!string.IsNullOrWhiteSpace(query.Status))
            q = q.Where(x => x.Unit.Status == query.Status);

        if (!string.IsNullOrWhiteSpace(query.PropertyType))
            q = q.Where(x => x.Property.PropertyType == query.PropertyType);

        if (!string.IsNullOrWhiteSpace(query.Category))
            q = q.Where(x => x.Property.Category == query.Category);

        if (query.PropertyId.HasValue)
            q = q.Where(x => x.Property.Id == query.PropertyId.Value);

        if (query.Advertised.HasValue)
            q = q.Where(x => x.Unit.IsListed == query.Advertised.Value);

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var s = query.Search.Trim();
            // Covers what someone actually searches a stock list by: the tower, where it is, the
            // door number, and the owner or agent whose listing they are trying to find again.
            q = q.Where(x => x.Property.Name.Contains(s)
                          || x.Property.City.Contains(s)
                          || x.Property.Address.Contains(s)
                          || x.Property.PropertyNumber.Contains(s)
                          || x.Unit.UnitNumber.Contains(s)
                          || (x.Unit.OwnerName != null && x.Unit.OwnerName.Contains(s))
                          || (x.Unit.AgentName != null && x.Unit.AgentName.Contains(s))
                          || (x.Unit.BedsLabel != null && x.Unit.BedsLabel.Contains(s)));
        }

        return q;
    }

    /// <summary>
    /// A named type rather than an anonymous one, so <see cref="Build"/> can be returned from a
    /// method and reused by the summary handler.
    /// </summary>
    internal sealed class UnitWithProperty
    {
        public PropertyUnit Unit { get; init; } = null!;
        public Property Property { get; init; } = null!;
    }
}
