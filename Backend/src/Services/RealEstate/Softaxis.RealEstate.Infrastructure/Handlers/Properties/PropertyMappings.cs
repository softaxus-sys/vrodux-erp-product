using Microsoft.EntityFrameworkCore;
using Softaxis.RealEstate.Application.Properties.Dtos;
using Softaxis.RealEstate.Domain.Entities;
using Softaxis.RealEstate.Infrastructure.Persistence;

namespace Softaxis.RealEstate.Infrastructure.Handlers.Properties;

internal static class PropertyMappings
{
    /// <summary>
    /// Image metadata is passed in rather than read off <c>p.Images</c>.
    ///
    /// Reading the navigation would require Include(), and Include on this relationship loads the
    /// image BYTES — several megabytes per photo, for every property on the page. The bytes are
    /// served one at a time from their own endpoint instead, so nothing here ever touches them.
    /// </summary>
    public static PropertyDto ToDto(Property p, IReadOnlyList<PropertyImageDto>? images = null)
    {
        var gallery = images ?? [];
        return new PropertyDto(
            p.Id, p.PropertyNumber, p.Name, p.PropertyType, p.Status,
            new PropertyLocationDto(p.Address, p.City, p.Emirate),
            p.TotalArea, p.TotalUnits, p.OccupiedUnits, p.MarketValue, p.Developer, p.Description,
            p.TotalUnits > 0 ? Math.Round((double)p.OccupiedUnits / p.TotalUnits * 100, 1) : 0,
            p.Units.Where(u => !u.IsDeleted).Select(ToDto).ToList(),
            p.ListOnWebsite,
            p.PublishedAt,
            gallery,
            gallery.FirstOrDefault(i => i.IsPrimary)?.Id ?? gallery.FirstOrDefault()?.Id);
    }

    public static PropertyImageDto ToDto(PropertyImage i) => new(
        i.Id, i.ContentType, i.FileName, i.Caption, i.SortOrder, i.IsPrimary);

    public static PropertyUnitDto ToDto(PropertyUnit u) => new(
        u.Id, u.UnitNumber, u.UnitType, u.Area, u.Floor, u.RentPerYear, u.SalePrice, u.Status,
        u.CurrentTenantId, u.CurrentTenantName);

    /// <summary>
    /// Loads gallery metadata for many properties in ONE query, keyed by property.
    /// Used by the list handler so a page of results costs a single extra round trip rather than
    /// one per property.
    /// </summary>
    public static async Task<Dictionary<Guid, List<PropertyImageDto>>> LoadImagesAsync(
        RealEstateDbContext db, IReadOnlyCollection<Guid> propertyIds, CancellationToken ct)
    {
        if (propertyIds.Count == 0) return [];

        // The projection is what keeps Data out of the SQL SELECT. Materialising the entity and
        // mapping afterwards would fetch the bytes and then discard them.
        var rows = await db.PropertyImages.AsNoTracking()
            .Where(i => propertyIds.Contains(i.PropertyId) && !i.IsDeleted)
            .OrderBy(i => i.SortOrder)
            .Select(i => new
            {
                i.PropertyId,
                Dto = new PropertyImageDto(i.Id, i.ContentType, i.FileName, i.Caption, i.SortOrder, i.IsPrimary),
            })
            .ToListAsync(ct);

        return rows
            .GroupBy(r => r.PropertyId)
            .ToDictionary(g => g.Key, g => g.Select(r => r.Dto).ToList());
    }
}
