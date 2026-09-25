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
