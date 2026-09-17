using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.RealEstate.Application.Properties.Dtos;
using Softaxis.RealEstate.Application.PublicListings.Dtos;
using Softaxis.RealEstate.Application.PublicListings.Queries;
using Softaxis.RealEstate.Domain.Entities;
using Softaxis.RealEstate.Infrastructure.Persistence;

namespace Softaxis.RealEstate.Infrastructure.Handlers.PublicListings;

/// <summary>
/// Shared scoping for the anonymous website endpoints.
///
/// ⚠ These endpoints have NO ambient tenant, and the tenant query filter is
/// <c>BypassFilter || TenantId == ambient</c> where <c>BypassFilter =&gt; !IsResolved ||
/// IsSuperAdmin</c>. Unresolved means bypass is TRUE, so on a public request the global filter
/// lets EVERY tenant's rows through. Nothing here may rely on it. Every query must carry the
/// explicit OwnerTenantId predicate below — omitting it publishes the entire platform's
/// portfolio on one customer's website.
/// </summary>
/// <summary>Just enough of an image to build a listing: its id and its place in the gallery.</summary>
internal readonly record struct ImageRef(Guid Id, int SortOrder, bool IsPrimary);

internal static class PublicListingScope
{
    /// <summary>
    /// Resolves the slug to a live tenant, or null.
    ///
    /// Suspended and expired workspaces resolve to null so a lapsed customer's listings stop
    /// being served — the website going quiet is the intended consequence of non-payment.
    /// </summary>
    public static async Task<TenantLookup?> ResolveTenantAsync(
        RealEstateDbContext db, string slug, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(slug)) return null;

        var normalised = slug.Trim().ToLowerInvariant();
        var tenant = await db.TenantLookups.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Slug == normalised, ct);

        return tenant is null || tenant.Status is "Suspended" or "Expired" ? null : tenant;
    }

    /// <summary>
    /// Published, non-deleted properties belonging to exactly one tenant.
    ///
    /// Note the column is OwnerTenantId, not TenantIsolation.Column — this service already uses
    /// "TenantId" to mean the RENTER, so the SaaS tenant lives under a different name here.
    /// </summary>
    public static IQueryable<Property> PublishedFor(RealEstateDbContext db, Guid tenantId) =>
        db.Properties.AsNoTracking()
            .Where(p => p.ListOnWebsite
                        && !p.IsDeleted
                        && EF.Property<Guid?>(p, RealEstateDbContext.OwnerTenant) == tenantId);

    public static readonly Error NotFound =
        Error.Custom("Listing.NotFound", "That listing is not available.");

    /// <summary>
    /// Deliberately the same error for "no such workspace" and "not published".
    ///
    /// Distinguishing them would let anyone probe which property ids exist and which are being
    /// held back from the market.
    /// </summary>
    public static PublicPropertyDto ToDto(Property p, IReadOnlyList<ImageRef> images)
    {
        var live = p.Units.Where(u => !u.IsDeleted).ToList();
        var ordered = images.OrderBy(i => i.SortOrder).ToList();

        return new PublicPropertyDto(
            p.Id,
            p.PropertyNumber,
            p.Name,
            p.PropertyType,
            p.Address,
            p.City,
            p.Emirate,
            p.TotalArea,
            p.TotalUnits,
            live.Count(u => u.Status == "vacant"),
            p.Developer,
            p.Description,
            p.PublishedAt,
            ordered.Select(i => i.Id).ToList(),
            ordered.FirstOrDefault(i => i.IsPrimary)?.Id ?? ordered.FirstOrDefault()?.Id,
            // Only what is actually available is advertised. A rented unit on a public listing
            // page is an enquiry the agent cannot fulfil.
            live.Where(u => u.Status == "vacant").Select(ToDto).ToList());
    }

    private static PublicUnitDto ToDto(PropertyUnit u) => new(
        u.Id, u.UnitNumber, u.UnitType, u.Area, u.Floor, u.RentPerYear, u.SalePrice,
        u.Furnishing, u.View, u.Bedrooms, u.Bathrooms, u.Parking);
}

internal sealed class GetPublicCompanyHandler(RealEstateDbContext db)
    : IQueryHandler<GetPublicCompanyQuery, PublicCompanyDto>
{
    public async Task<Result<PublicCompanyDto>> Handle(GetPublicCompanyQuery query, CancellationToken ct)
    {
        var tenant = await PublicListingScope.ResolveTenantAsync(db, query.TenantSlug, ct);
        return tenant is null
            ? Result.Failure<PublicCompanyDto>(PublicListingScope.NotFound)
            : Result.Success(new PublicCompanyDto(tenant.Name, tenant.Slug));
    }
}

internal sealed class GetPublicPropertiesHandler(RealEstateDbContext db)
    : IQueryHandler<GetPublicPropertiesQuery, PagedResult<PublicPropertyDto>>
{
    private const int MaxPageSize = 60;

    public async Task<Result<PagedResult<PublicPropertyDto>>> Handle(
        GetPublicPropertiesQuery query, CancellationToken ct)
    {
        var tenant = await PublicListingScope.ResolveTenantAsync(db, query.TenantSlug, ct);
        if (tenant is null)
            return Result.Failure<PagedResult<PublicPropertyDto>>(PublicListingScope.NotFound);

        var page     = Math.Max(1, query.Page);
        var pageSize = Math.Clamp(query.PageSize, 1, MaxPageSize);

        IQueryable<Property> q = PublicListingScope.PublishedFor(db, tenant.Id).Include(p => p.Units);

        if (!string.IsNullOrWhiteSpace(query.PropertyType))
            q = q.Where(p => p.PropertyType == query.PropertyType);

        if (!string.IsNullOrWhiteSpace(query.Emirate))
            q = q.Where(p => p.Emirate == query.Emirate);

        if (!string.IsNullOrWhiteSpace(query.City))
            q = q.Where(p => p.City == query.City);

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var term = query.Search.Trim();
            q = q.Where(p => p.Name.Contains(term)
                          || p.Address.Contains(term)
                          || p.City.Contains(term));
        }

        var total = await q.CountAsync(ct);

        var items = await q
            // Newest publication first: a website's front page should lead with what has just
            // come to market.
            .OrderByDescending(p => p.PublishedAt).ThenBy(p => p.Name).ThenBy(p => p.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        var images = await LoadImagesAsync(db, items.Select(i => i.Id).ToList(), ct);

        return Result.Success(PagedResult<PublicPropertyDto>.Create(
            items.Select(p => PublicListingScope.ToDto(p, images.GetValueOrDefault(p.Id, []))).ToList(),
            total, page, pageSize));
    }

    /// <summary>
    /// Image METADATA for a whole page in one query. Data is never selected — these responses go
    /// to a public website and would otherwise be megabytes per property.
    /// </summary>
    internal static async Task<Dictionary<Guid, List<ImageRef>>> LoadImagesAsync(
        RealEstateDbContext db, IReadOnlyCollection<Guid> propertyIds, CancellationToken ct)
    {
        if (propertyIds.Count == 0) return [];

        var rows = await db.PropertyImages.AsNoTracking()
            .Where(i => propertyIds.Contains(i.PropertyId) && !i.IsDeleted)
            .OrderBy(i => i.SortOrder)
            .Select(i => new { i.PropertyId, Ref = new ImageRef(i.Id, i.SortOrder, i.IsPrimary) })
            .ToListAsync(ct);

        return rows
            .GroupBy(r => r.PropertyId)
            .ToDictionary(g => g.Key, g => g.Select(r => r.Ref).ToList());
    }
}

internal sealed class GetPublicPropertyHandler(RealEstateDbContext db)
    : IQueryHandler<GetPublicPropertyQuery, PublicPropertyDto>
{
    public async Task<Result<PublicPropertyDto>> Handle(GetPublicPropertyQuery query, CancellationToken ct)
    {
        var tenant = await PublicListingScope.ResolveTenantAsync(db, query.TenantSlug, ct);
        if (tenant is null) return Result.Failure<PublicPropertyDto>(PublicListingScope.NotFound);

        var property = await PublicListingScope.PublishedFor(db, tenant.Id)
            .Include(p => p.Units)
            .FirstOrDefaultAsync(p => p.Id == query.Id, ct);

        if (property is null) return Result.Failure<PublicPropertyDto>(PublicListingScope.NotFound);

        var images = await GetPublicPropertiesHandler.LoadImagesAsync(db, [property.Id], ct);
        return Result.Success(PublicListingScope.ToDto(property, images.GetValueOrDefault(property.Id, [])));
    }
}

internal sealed class GetPublicPropertyImageHandler(RealEstateDbContext db)
    : IQueryHandler<GetPublicPropertyImageQuery, PropertyImageFileDto>
{
    public async Task<Result<PropertyImageFileDto>> Handle(
        GetPublicPropertyImageQuery query, CancellationToken ct)
    {
        var tenant = await PublicListingScope.ResolveTenantAsync(db, query.TenantSlug, ct);
        if (tenant is null) return Result.Failure<PropertyImageFileDto>(PublicListingScope.NotFound);

        // The property is re-checked as published on every image request. Without this, a photo
        // stays publicly fetchable after its property is withdrawn from the website.
        var published = await PublicListingScope.PublishedFor(db, tenant.Id)
            .AnyAsync(p => p.Id == query.PropertyId, ct);

        if (!published) return Result.Failure<PropertyImageFileDto>(PublicListingScope.NotFound);

        var image = await db.PropertyImages.AsNoTracking()
            .Where(i => i.Id == query.ImageId && i.PropertyId == query.PropertyId && !i.IsDeleted)
            .Select(i => new PropertyImageFileDto(i.Data, i.ContentType))
            .FirstOrDefaultAsync(ct);

        return image is null
            ? Result.Failure<PropertyImageFileDto>(PublicListingScope.NotFound)
            : Result.Success(image);
    }
}
