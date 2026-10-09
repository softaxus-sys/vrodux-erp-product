using Softaxis.RealEstate.Application.Abstractions;
using Softaxis.RealEstate.Application.Units.Dtos;
using Softaxis.RealEstate.Domain.Entities;
using Softaxis.RealEstate.Infrastructure.Services;

namespace Softaxis.RealEstate.Infrastructure.Handlers.Units;

internal static class UnitMappings
{
    /// <summary>
    /// Owner name/phone/second-phone are masked to null exactly like <c>ListingMappings</c> does for
    /// the same columns on the same entity -- this is the OTHER read path onto <c>PropertyUnit</c>
    /// (the legacy GET this controller kept for callers that never moved to /listings) and it was
    /// found returning every listing's owner contact details to anyone holding plain
    /// <c>real-estate.units.view</c>, with no regard for <see cref="PropertyUnit.RestrictConfidentialDetails"/>
    /// or the assigned agent -- a straight bypass of the confidentiality feature via the older
    /// endpoint. <see cref="ListingConfidentiality.CanView"/> is the single source of truth for this
    /// decision; it must not be re-derived here.
    /// </summary>
    public static UnitDto ToDto(PropertyUnit u, ICurrentUser user)
    {
        var canView = ListingConfidentiality.CanView(user, u.AgentUserId, u.RestrictConfidentialDetails);
        return new(
            u.Id, u.PropertyId, u.UnitNumber, u.UnitType, u.Area, u.Floor,
            u.RentPerYear, u.SalePrice, u.Status, u.CurrentTenantId, u.CurrentTenantName,
            u.Furnishing, u.View, u.Bedrooms, u.Bathrooms, u.Parking, u.ServiceCharge, u.Notes,
            u.Purpose, u.ListedOn, u.BedsLabel, u.PriceLabel, u.AreaLabel,
            u.HasMedia, u.IsListed, u.ListedBy, u.AgentName,
            canView ? u.OwnerName : null, canView ? u.OwnerPhone : null, canView ? u.OwnerPhoneAlt : null);
    }
}
