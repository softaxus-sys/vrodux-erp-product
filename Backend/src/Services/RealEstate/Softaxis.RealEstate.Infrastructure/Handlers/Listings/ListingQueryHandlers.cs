using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.RealEstate.Application.Abstractions;
using Softaxis.RealEstate.Application.Listings.Dtos;
using Softaxis.RealEstate.Application.Listings.Queries;
using Softaxis.RealEstate.Infrastructure.Persistence;
using Softaxis.RealEstate.Infrastructure.Services;

namespace Softaxis.RealEstate.Infrastructure.Handlers.Listings;

internal sealed class GetListingByIdHandler(RealEstateDbContext db, ICurrentUser user)
    : IQueryHandler<GetListingByIdQuery, ListingDto>
{
    public async Task<Result<ListingDto>> Handle(GetListingByIdQuery query, CancellationToken ct)
    {
        var row = await (from u in db.PropertyUnits.AsNoTracking().Where(x => !x.IsDeleted && x.Id == query.Id)
                         join p in db.Properties.AsNoTracking().Where(x => !x.IsDeleted)
                             on u.PropertyId equals p.Id
                         select new { Unit = u, Property = p })
            .FirstOrDefaultAsync(ct);

        if (row is null) return Result.Failure<ListingDto>(Error.NotFoundById("Listing", query.Id));

        var galleries = await ListingMappings.LoadGalleriesAsync(db, [row.Property.Id], ct);

        var dto = ListingMappings.ToDto(
            row.Unit, row.Property, galleries.GetValueOrDefault(row.Property.Id, default));

        return Result.Success(ListingMappings.ApplyConfidentiality(
            dto,
            ListingConfidentiality.CanView(user, row.Unit.AgentUserId, row.Unit.RestrictConfidentialDetails),
            ListingConfidentiality.CanManage(user, row.Unit.AgentUserId)));
    }
}

internal sealed class GetListingsSummaryHandler(RealEstateDbContext db)
    : IQueryHandler<GetListingsSummaryQuery, ListingsSummaryDto>
{
    public async Task<Result<ListingsSummaryDto>> Handle(GetListingsSummaryQuery query, CancellationToken ct)
    {
        // Built from the same join the list uses, so the tiles can never count a different set of
        // rows than the table below them.
        var rows = await GetListingsHandler.Build(db, new GetListingsQuery())
            .Select(x => new
            {
                x.Unit.Purpose,
                x.Unit.Status,
                x.Unit.HasMedia,
                x.Unit.IsListed,
                x.Unit.RentPerYear,
                x.Unit.SalePrice,
                PropertyId = x.Property.Id,
            })
            .ToListAsync(ct);

        return Result.Success(new ListingsSummaryDto(
            rows.Count,
            rows.Count(r => r.Purpose == "rent"),
            rows.Count(r => r.Purpose == "sale"),
            rows.Count(r => r.Status == "vacant"),
            rows.Count(r => r.Status == "rented"),
            rows.Count(r => r.HasMedia),
            rows.Count(r => r.IsListed),
            // Each total counts only the listings it applies to. Summing the rent of units that
            // are up for sale would inflate a figure an agency reads as its rent roll.
            rows.Where(r => r.Purpose != "sale").Sum(r => r.RentPerYear),
            rows.Where(r => r.Purpose != "rent").Sum(r => r.SalePrice),
            rows.Select(r => r.PropertyId).Distinct().Count()));
    }
}

internal sealed class GetPropertyTypesHandler(RealEstateDbContext db)
    : IQueryHandler<GetPropertyTypesQuery, IReadOnlyList<string>>
{
    /// <summary>
    /// What a UAE agency deals in, offered before anyone has typed anything.
    /// </summary>
    /// <remarks>
    /// A starting point, not the allowed set — the picker lets a new type be typed, and it then
    /// comes back from the database for everyone. Hardcoding the whole list is what made the old
    /// eight-item dropdown collapse a "Warehouse" into "Commercial Building" on save.
    /// </remarks>
    private static readonly string[] Defaults =
    [
        "Apartment", "Villa", "Townhouse", "Penthouse", "Duplex", "Plot / Land",
        "Building", "Office", "Retail Shop", "Warehouse", "Labour Camp", "Hotel Apartment",
    ];

    public async Task<Result<IReadOnlyList<string>>> Handle(GetPropertyTypesQuery query, CancellationToken ct)
    {
        var inUse = await db.Properties.AsNoTracking()
            .Where(p => !p.IsDeleted && p.PropertyType != null && p.PropertyType != "")
            .Select(p => p.PropertyType)
            .Distinct()
            .ToListAsync(ct);

        var all = Defaults
            .Concat(inUse)
            // Case-insensitive, so "apartment" typed once does not sit beside "Apartment" for ever.
            .GroupBy(t => t.Trim(), StringComparer.OrdinalIgnoreCase)
            .Select(g => g.Key)
            .OrderBy(t => t, StringComparer.OrdinalIgnoreCase)
            .ToList();

        return Result.Success<IReadOnlyList<string>>(all);
    }
}
