namespace Softaxis.CRM.Application.LeadIntake.Abstractions;

/// <summary>One agent as the source portal knows them.</summary>
public sealed record PortalAgent(string Key, string? Name, string? Email, string? Phone);

/// <summary>
/// Looks up a portal agent by the id the portal put on the enquiry.
///
/// <para>Why this exists: a Property Finder lead identifies its agent only as
/// <c>publicProfile.id</c> — a number, with no email or phone anywhere in the payload. Until an
/// admin ran the import wizard and mapped that number to a login, every one of that agent's leads
/// fell through to round-robin. Resolving the number against the portal's own user directory lets
/// the agent be matched to a login by email or phone the first time they send a lead.</para>
///
/// <para>Implementations must be fail-soft: the directory is a remote call on an intake path that
/// runs for every inbound enquiry, and a portal being slow or down must never cost the lead.</para>
/// </summary>
public interface IPortalAgentDirectory
{
    /// <summary>True when this directory can answer for the given provider.</summary>
    bool Handles(string providerKey);

    /// <summary>The agent behind <paramref name="agentKey"/>, or null when unknown/unavailable.</summary>
    Task<PortalAgent?> FindAsync(Guid integrationId, string providerKey, string agentKey, CancellationToken ct);
}
