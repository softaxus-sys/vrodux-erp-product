using Microsoft.EntityFrameworkCore;
using Softaxis.RealEstate.Application.Listings.Dtos;
using Softaxis.RealEstate.Domain.Entities;
using Softaxis.RealEstate.Infrastructure.Persistence;
using Softaxis.RealEstate.Infrastructure.Services;

namespace Softaxis.RealEstate.Infrastructure.Handlers.Listings;

/// <summary>The gallery facts a listing row needs, without ever touching the image bytes.</summary>
internal readonly record struct GalleryInfo(Guid? PrimaryImageId, int Count);

internal static class ListingMappings
{
    /// <summary>
    /// Full, unmasked mapping. Every caller of this must apply <see cref="ApplyConfidentiality"/>
    /// before the DTO leaves the handler, UNLESS the caller is the one who just supplied the
    /// confidential values themselves (create/import — see the handlers' own comments on why that
    /// case is exempt).
    /// </summary>
    public static ListingDto ToDto(PropertyUnit u, Property p, GalleryInfo gallery) => new(
        u.Id, p.Id, p.PropertyNumber,
        p.Name, p.PropertyType, p.Category, p.Address, p.City, p.Emirate,
        p.ListOnWebsite, gallery.PrimaryImageId, gallery.Count,
        u.UnitNumber, u.UnitType, u.Area, u.Floor, u.RentPerYear, u.SalePrice, u.Status,
        u.CurrentTenantId, u.CurrentTenantName,
        u.Furnishing, u.View, u.Bedrooms, u.Bathrooms, u.Parking, u.ServiceCharge, u.Notes,
        u.Purpose, u.ListedOn, u.BedsLabel, u.PriceLabel, u.AreaLabel,
        u.HasMedia, u.IsListed, u.ListedBy, u.AgentName,
        u.AgentUserId, HasConfidentialAccess: true, u.RestrictConfidentialDetails,
        CanManageConfidential: true,
        u.OwnerName, u.OwnerPhone, u.OwnerPhoneAlt);

    /// <summary>
    /// Nulls out Unit Number and the owner fields when <paramref name="canView"/> is false, and
    /// stamps <see cref="ListingDto.HasConfidentialAccess"/> / <see cref="ListingDto.CanManageConfidential"/>
    /// so the UI can tell "restricted", "viewable but not editable", and "fully open" apart.
    /// </summary>
    public static ListingDto ApplyConfidentiality(ListingDto dto, bool canView, bool canManage) =>
        (canView
            ? dto with { HasConfidentialAccess = true }
            : dto with
            {
                HasConfidentialAccess = false,
                UnitNumber = null,
                OwnerName = null,
                OwnerPhone = null,
                OwnerPhoneAlt = null,
            })
        with { CanManageConfidential = canManage };

    /// <summary>
    /// Gallery facts for a whole page of listings in ONE query, keyed by property.
    /// </summary>
    /// <remarks>
    /// Projects the id and the primary flag and nothing else. Loading the entity would pull the
    /// photograph bytes back — megabytes per row — only to discard them, which is the trap
    /// PropertyMappings.LoadImagesAsync exists to avoid.
    /// </remarks>
    public static async Task<Dictionary<Guid, GalleryInfo>> LoadGalleriesAsync(
        RealEstateDbContext db, IReadOnlyCollection<Guid> propertyIds, CancellationToken ct)
    {
        if (propertyIds.Count == 0) return [];

        var rows = await db.PropertyImages.AsNoTracking()
            .Where(i => propertyIds.Contains(i.PropertyId) && !i.IsDeleted)
            .OrderBy(i => i.SortOrder)
            .Select(i => new { i.PropertyId, i.Id, i.IsPrimary })
            .ToListAsync(ct);

        return rows
            .GroupBy(r => r.PropertyId)
            .ToDictionary(
                g => g.Key,
                // Falls back to the first by sort order, so a gallery whose primary was deleted
                // still shows a picture rather than a blank tile.
                g => new GalleryInfo(
                    (g.FirstOrDefault(r => r.IsPrimary) ?? g.First()).Id,
                    g.Count()));
    }
}
