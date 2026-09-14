using Softaxis.CRM.Application.LeadIntake.Dtos;
using Softaxis.CRM.Domain.Entities.Integrations;

namespace Softaxis.CRM.Application.LeadIntake.Abstractions;

/// <summary>
/// Works out which user in this workspace a portal enquiry belongs to — the agent map, the
/// listing → agent map, and finally matching the portal's agent to a login by email or phone.
///
/// <para>Exposed as its own interface so the assignment backfill can reach the very same
/// resolution the live intake path uses. A backfill that re-implemented these rules would drift
/// from them, and the first symptom would be historical leads assigned to different people than
/// new ones — the hardest kind of inconsistency to notice.</para>
/// </summary>
public interface IPortalOwnerResolver
{
    /// <param name="lead">
    /// Only the portal-identity fields are read: <see cref="CanonicalLead.ExternalOwnerId"/>,
    /// <see cref="CanonicalLead.ExternalOwnerEmail"/>, <see cref="CanonicalLead.ExternalOwnerPhone"/>,
    /// <see cref="CanonicalLead.ExternalOwnerName"/>, <see cref="CanonicalLead.ListingReference"/>
    /// and <see cref="CanonicalLead.ListingId"/>. The backfill fills those from a stored lead.
    /// </param>
    Task<LeadOwner?> ResolveAsync(CanonicalLead lead, Integration? integration, Guid tenantId, CancellationToken ct);
}
