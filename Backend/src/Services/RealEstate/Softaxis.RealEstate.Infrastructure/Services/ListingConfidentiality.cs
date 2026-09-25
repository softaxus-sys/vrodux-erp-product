using Softaxis.RealEstate.Application.Abstractions;

namespace Softaxis.RealEstate.Infrastructure.Services;

/// <summary>
/// Who may see a listing's confidential columns — Unit Number and Owner Details (name, phone,
/// second phone). Kept out of everyone else's reach for the same compliance reason agencies keep
/// these off a shared sheet: a door number plus an owner's direct line is what lets a staff member
/// go around the agency, or a competitor poach a lead.
///
/// <para>Default visibility (no configuration needed): the tenant admin (super-admin bypass, or
/// anyone holding the tenant-wide <c>real-estate.units.view-confidential</c> permission — the same
/// "full tier" vocabulary used everywhere else in this codebase) and the listing's own assigned
/// agent. Configurable two ways: granting <c>real-estate.units.view-confidential</c> to a role
/// widens visibility tenant-wide, and unchecking "Restrict to owner/agent only" on a specific
/// listing (<see cref="Softaxis.RealEstate.Domain.Entities.PropertyUnit.RestrictConfidentialDetails"/>)
/// opens just that listing to every staff member who can already see it.</para>
/// </summary>
internal static class ListingConfidentiality
{
    public const string Permission = "real-estate.units.view-confidential";

    /// <param name="restricted">
    /// The listing's own <c>RestrictConfidentialDetails</c> flag. False short-circuits everything
    /// else — an unrestricted listing is open to anyone who could load it at all, admin, agent or
    /// otherwise, because someone explicitly decided this one owner's details are not sensitive.
    /// </param>
    public static bool CanView(ICurrentUser user, Guid? agentUserId, bool restricted) =>
        !restricted || CanManage(user, agentUserId);

    /// <summary>
    /// True when the caller can see every listing's confidential columns, independent of which one
    /// is the assigned agent. Used to decide whether the search box may match on owner data at all —
    /// matching it for someone who cannot see the result is itself a leak (an oracle: "no results"
    /// vs "one result" already tells them the owner exists), so the widened search is restricted to
    /// exactly the same population as the column itself.
    /// </summary>
    public static bool CanViewAll(ICurrentUser user) =>
        user.IsSuperAdmin || user.HasPermission(Permission);

    /// <summary>
    /// Who may CHANGE Unit Number / Owner Details, reassign the agent, or flip the restriction
    /// switch — always just the tenant admin and this listing's own agent, regardless of whether
    /// <see cref="Softaxis.RealEstate.Domain.Entities.PropertyUnit.RestrictConfidentialDetails"/>
    /// happens to be off right now. Unchecking the restriction opens VIEWING to every staff member;
    /// it must never also open editing the owner's phone number or quietly re-locking the listing
    /// to whoever last touched it — that is a materially different, and much larger, grant.
    /// </summary>
    public static bool CanManage(ICurrentUser user, Guid? agentUserId) =>
        CanViewAll(user)
        || (agentUserId.HasValue && user.Id.HasValue && agentUserId.Value == user.Id.Value);
}
