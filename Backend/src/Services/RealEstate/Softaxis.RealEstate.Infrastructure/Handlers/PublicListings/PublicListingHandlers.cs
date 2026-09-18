using System.Security.Cryptography;
using System.Text;
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
/// Just enough of an image to build a listing: its id and its place in the gallery.
///
/// A record CLASS, not a record struct. FirstOrDefault over a struct returns a zero value rather
/// than null, so an empty gallery would have yielded Guid.Empty as the cover image.
/// </summary>
internal sealed record ImageRef(Guid Id, int SortOrder, bool IsPrimary);

/// <summary>
/// Shared scoping for the website endpoints.
///
/// ⚠ These endpoints have NO ambient tenant, and the tenant query filter is
/// <c>BypassFilter || TenantId == ambient</c> where <c>BypassFilter =&gt; !IsResolved ||
/// IsSuperAdmin</c>. Unresolved means bypass is TRUE, so on these requests the global filter lets
/// EVERY tenant's rows through. Nothing here may rely on it: every query carries the explicit
/// OwnerTenantId predicate, with the tenant taken from the API key — never from the caller.
/// </summary>
internal static class PublicListingScope
{
    /// <summary>How long a signed image URL stays valid.</summary>
    private static readonly TimeSpan ImageUrlLifetime = TimeSpan.FromDays(7);

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

    /// <summary>The same error for "does not exist", "not published" and "bad signature", so ids cannot be probed.</summary>
    public static readonly Error NotFound =
        Error.Custom("Listing.NotFound", "That listing is not available.");

    public static PublicPropertyDto ToDto(
        Property p, IReadOnlyList<ImageRef> images, Guid integrationId, string keyHash)
    {
        var live = p.Units.Where(u => !u.IsDeleted).ToList();
        var ordered = images
            .OrderByDescending(i => i.IsPrimary)
            .ThenBy(i => i.SortOrder)
            .Select(i => ImageUrl(integrationId, keyHash, p.Id, i.Id))
            .ToList();

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
            ordered,
            // Only what is actually available is advertised. A rented unit on a public listing
            // page is an enquiry the agent cannot fulfil.
            live.Where(u => u.Status == "vacant").Select(ToDto).ToList());
    }

    private static PublicUnitDto ToDto(PropertyUnit u) => new(
        u.Id, u.UnitNumber, u.UnitType, u.Area, u.Floor, u.RentPerYear, u.SalePrice,
        u.Furnishing, u.View, u.Bedrooms, u.Bathrooms, u.Parking);

    /// <summary>
    /// A relative, signed image path. Expiry is rounded to the day so the URL is identical across
    /// requests within a day — otherwise every page load would bust the website's image cache.
    /// </summary>
    private static string ImageUrl(Guid integrationId, string keyHash, Guid propertyId, Guid imageId)
    {
        var expires = DateTimeOffset.UtcNow.Add(ImageUrlLifetime).Date;
        var exp = new DateTimeOffset(expires, TimeSpan.Zero).ToUnixTimeSeconds();
        var sig = Sign(keyHash, integrationId, propertyId, imageId, exp);
        return $"/api/real-estate/website/images/{integrationId}/{propertyId}/{imageId}?exp={exp}&sig={sig}";
    }

    /// <summary>
    /// HMAC keyed by the integration's key hash — a server-only secret. Regenerating the API key
    /// therefore also invalidates every image URL issued under the old one.
    /// </summary>
    public static string Sign(string keyHash, Guid integrationId, Guid propertyId, Guid imageId, long exp)
    {
        var payload = Encoding.UTF8.GetBytes($"{integrationId:N}:{propertyId:N}:{imageId:N}:{exp}");
        var mac = HMACSHA256.HashData(Encoding.UTF8.GetBytes(keyHash), payload);
        return Convert.ToBase64String(mac).TrimEnd('=').Replace('+', '-').Replace('/', '_');
    }

    /// <summary>Image METADATA for a whole page in one query. Bytes are never selected here.</summary>
    public static async Task<Dictionary<Guid, List<ImageRef>>> LoadImagesAsync(
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

    /// <summary>The key hash for signing. Read per request so a regenerated key takes effect at once.</summary>
    public static Task<string?> KeyHashAsync(RealEstateDbContext db, Guid integrationId, CancellationToken ct) =>
        db.WebsiteIntegrations.IgnoreQueryFilters().AsNoTracking()
            .Where(w => w.Id == integrationId && w.IsActive)
            .Select(w => w.KeyHash)
            .FirstOrDefaultAsync(ct);
}

internal sealed class GetPublicPropertiesHandler(RealEstateDbContext db)
    : IQueryHandler<GetPublicPropertiesQuery, PagedResult<PublicPropertyDto>>
{
    private const int MaxPageSize = 60;

    public async Task<Result<PagedResult<PublicPropertyDto>>> Handle(
        GetPublicPropertiesQuery query, CancellationToken ct)
    {
        var keyHash = await PublicListingScope.KeyHashAsync(db, query.Client.IntegrationId, ct);
        if (keyHash is null) return Result.Failure<PagedResult<PublicPropertyDto>>(PublicListingScope.NotFound);

        var page     = Math.Max(1, query.Page);
        var pageSize = Math.Clamp(query.PageSize, 1, MaxPageSize);

        IQueryable<Property> q = PublicListingScope.PublishedFor(db, query.Client.TenantId).Include(p => p.Units);

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
            .OrderByDescending(p => p.PublishedAt).ThenBy(p => p.Name).ThenBy(p => p.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        var images = await PublicListingScope.LoadImagesAsync(db, items.Select(i => i.Id).ToList(), ct);

        return Result.Success(PagedResult<PublicPropertyDto>.Create(
            items.Select(p => PublicListingScope.ToDto(
                p, images.GetValueOrDefault(p.Id, []), query.Client.IntegrationId, keyHash)).ToList(),
            total, page, pageSize));
    }
}

internal sealed class GetPublicPropertyHandler(RealEstateDbContext db)
    : IQueryHandler<GetPublicPropertyQuery, PublicPropertyDto>
{
    public async Task<Result<PublicPropertyDto>> Handle(GetPublicPropertyQuery query, CancellationToken ct)
    {
        var keyHash = await PublicListingScope.KeyHashAsync(db, query.Client.IntegrationId, ct);
        if (keyHash is null) return Result.Failure<PublicPropertyDto>(PublicListingScope.NotFound);

        var property = await PublicListingScope.PublishedFor(db, query.Client.TenantId)
            .Include(p => p.Units)
            .FirstOrDefaultAsync(p => p.Id == query.Id, ct);

        if (property is null) return Result.Failure<PublicPropertyDto>(PublicListingScope.NotFound);

        var images = await PublicListingScope.LoadImagesAsync(db, [property.Id], ct);
        return Result.Success(PublicListingScope.ToDto(
            property, images.GetValueOrDefault(property.Id, []), query.Client.IntegrationId, keyHash));
    }
}

internal sealed class GetPublicPropertyImageHandler(RealEstateDbContext db)
    : IQueryHandler<GetPublicPropertyImageQuery, PropertyImageFileDto>
{
    public async Task<Result<PropertyImageFileDto>> Handle(
        GetPublicPropertyImageQuery query, CancellationToken ct)
    {
        if (query.Expires < DateTimeOffset.UtcNow.ToUnixTimeSeconds())
            return Result.Failure<PropertyImageFileDto>(PublicListingScope.NotFound);

        // Integration must still exist and be enabled; its tenant scopes everything below.
        var integration = await db.WebsiteIntegrations.IgnoreQueryFilters().AsNoTracking()
            .Where(w => w.Id == query.IntegrationId && w.IsActive)
            .Select(w => new { w.KeyHash, TenantId = EF.Property<Guid?>(w, RealEstateDbContext.OwnerTenant) })
            .FirstOrDefaultAsync(ct);

        if (integration?.TenantId is null)
            return Result.Failure<PropertyImageFileDto>(PublicListingScope.NotFound);

        var expected = PublicListingScope.Sign(
            integration.KeyHash, query.IntegrationId, query.PropertyId, query.ImageId, query.Expires);

        if (!CryptographicOperations.FixedTimeEquals(
                Encoding.ASCII.GetBytes(expected), Encoding.ASCII.GetBytes(query.Signature ?? "")))
            return Result.Failure<PropertyImageFileDto>(PublicListingScope.NotFound);

        // Re-checked as published on every request: withdrawing a property must stop its photos too.
        var published = await PublicListingScope.PublishedFor(db, integration.TenantId.Value)
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
