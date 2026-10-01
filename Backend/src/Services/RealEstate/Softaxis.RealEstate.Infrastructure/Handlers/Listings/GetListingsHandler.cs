using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.RealEstate.Application.Abstractions;
using Softaxis.RealEstate.Application.Listings.Dtos;
using Softaxis.RealEstate.Application.Listings.Queries;
using Softaxis.RealEstate.Domain.Entities;
using Softaxis.RealEstate.Infrastructure.Persistence;
using Softaxis.RealEstate.Infrastructure.Services;

namespace Softaxis.RealEstate.Infrastructure.Handlers.Listings;

internal sealed class GetListingsHandler(RealEstateDbContext db, ICurrentUser user)
    : IQueryHandler<GetListingsQuery, PagedResult<ListingDto>>
{
    /// <summary>Capped so a hand-edited pageSize cannot ask for the whole set back.</summary>
    private const int MaxPageSize = 200;

    public async Task<Result<PagedResult<ListingDto>>> Handle(GetListingsQuery query, CancellationToken ct)
    {
        var page     = Math.Max(1, query.Page);
        var pageSize = Math.Clamp(query.PageSize, 1, MaxPageSize);

        var canViewAllConfidential = ListingConfidentiality.CanViewAll(user);
        var q = Build(db, query, canViewAllConfidential);

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
            .Select(r =>
            {
                var dto = ListingMappings.ToDto(
                    r.Unit, r.Property, galleries.GetValueOrDefault(r.Property.Id, default));
                return ListingMappings.ApplyConfidentiality(
                    dto,
                    ListingConfidentiality.CanView(user, r.Unit.AgentUserId, r.Unit.RestrictConfidentialDetails),
                    ListingConfidentiality.CanManage(user, r.Unit.AgentUserId));
            })
            .ToList();

        return Result.Success(PagedResult<ListingDto>.Create(items, total, page, pageSize));
    }

    /// <summary>
    /// The filtered unit-to-building join, shared with the summary so the tiles can never describe
    /// a different set of rows than the table beneath them.
    /// </summary>
    /// <param name="canViewAllConfidential">
    /// Whether the search box may match on the owner's name. Left false by default (the summary
    /// never searches, so it never matters there) — widening a search to a field the caller cannot
    /// then see would itself be a leak: a hit vs. no hit already tells them the owner exists.
    /// </param>
    internal static IQueryable<UnitWithProperty> Build(
        RealEstateDbContext db, GetListingsQuery query, bool canViewAllConfidential = false)
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

        // The multi-select filters. Each is copied to a local first: EF translates a captured
        // list to IN (...), but not a member access on the query record.
        if (query.PropertyIds is { Count: > 0 })
        {
            var ids = query.PropertyIds.ToList();
            q = q.Where(x => ids.Contains(x.Property.Id));
        }

        if (query.Bedrooms is { Count: > 0 })
        {
            var beds = query.Bedrooms.Select(b => (int?)b).ToList();
            q = q.Where(x => beds.Contains(x.Unit.Bedrooms));
        }

        if (query.PropertyTypes is { Count: > 0 })
        {
            var types = query.PropertyTypes.ToList();
            q = q.Where(x => types.Contains(x.Property.PropertyType));
        }

        if (query.Statuses is { Count: > 0 })
        {
            var statuses = query.Statuses.ToList();
            q = q.Where(x => statuses.Contains(x.Unit.Status));
        }

        if (query.Furnishings is { Count: > 0 })
        {
            var furnishings = query.Furnishings.ToList();
            q = q.Where(x => x.Unit.Furnishing != null && furnishings.Contains(x.Unit.Furnishing));
        }

        if (query.Cities is { Count: > 0 })
        {
            var cities = query.Cities.ToList();
            q = q.Where(x => cities.Contains(x.Property.City));
        }

        if (query.Agents is { Count: > 0 })
        {
            var agents = query.Agents.ToList();
            q = q.Where(x => x.Unit.AgentName != null && agents.Contains(x.Unit.AgentName));
        }

        // A listing has one price that matters: the asking price when it is for sale, the annual
        // rent otherwise. Comparing both columns would let a 7M sale match a "under 100k" search
        // through its empty rent.
        if (query.MinPrice.HasValue)
        {
            var min = query.MinPrice.Value;
            q = q.Where(x => (x.Unit.Purpose == "sale" ? x.Unit.SalePrice : x.Unit.RentPerYear) >= min);
        }

        if (query.MaxPrice.HasValue)
        {
            var max = query.MaxPrice.Value;
            q = q.Where(x => (x.Unit.Purpose == "sale" ? x.Unit.SalePrice : x.Unit.RentPerYear) <= max);
        }

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var s = query.Search.Trim();
            // Covers what someone actually searches a stock list by: the tower, where it is, the
            // door number, and the agent whose listing they are trying to find again. The owner's
            // name is only matched for a row the searcher could see anyway — either they hold the
            // tenant-wide permission, or this particular listing opted out of the restriction
            // (see the param doc above).
            q = q.Where(x => x.Property.Name.Contains(s)
                          || x.Property.City.Contains(s)
                          || x.Property.Address.Contains(s)
                          || x.Property.PropertyNumber.Contains(s)
                          || x.Unit.UnitNumber.Contains(s)
                          || ((canViewAllConfidential || !x.Unit.RestrictConfidentialDetails)
                              && x.Unit.OwnerName != null && x.Unit.OwnerName.Contains(s))
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
