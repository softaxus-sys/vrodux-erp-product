namespace Softaxis.CRM.Application.LeadIntake.Abstractions;

/// <summary>
/// Looks up which agent holds a portal LISTING, for sources whose enquiries do not name one.
///
/// <para>Bayut's WhatsApp push is the case this exists for: it carries the listing URL and
/// reference but no agent at all, so until the same property produced a pull enquiry (which does
/// carry <c>agent_details</c>) there was nothing to route on and the lead fell to round-robin.
/// Resolving the listing directly removes that wait.</para>
///
/// <para>Implementations must be fail-soft and cached. This runs on the intake path for every
/// inbound enquiry, and a lookup service being slow or down must never cost the lead.</para>
/// </summary>
public interface IPortalListingDirectory
{
    /// <summary>True when this directory can answer for the given provider.</summary>
    bool Handles(string providerKey);

    /// <summary>
    /// The agent holding <paramref name="listingId"/>, or null when unknown, unconfigured or
    /// unavailable — the three are deliberately indistinguishable to the caller, which treats all
    /// of them the same way.
    /// </summary>
    Task<PortalAgent?> FindListingAgentAsync(
        Guid integrationId, string providerKey, string listingId, CancellationToken ct);
}
