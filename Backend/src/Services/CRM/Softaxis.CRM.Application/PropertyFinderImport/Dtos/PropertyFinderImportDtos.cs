namespace Softaxis.CRM.Application.PropertyFinderImport.Dtos;

/// <summary>
/// One Property Finder user, with the figures needed to decide whether they should become a
/// Vrodux login. <see cref="PublicProfileId"/> is the join key: leads reference their owning
/// agent only by that id, never by user id.
/// </summary>
public sealed record PfAgentDto(
    int     PfUserId,
    int?    PublicProfileId,
    string  FullName,
    string? Email,
    string? Mobile,
    string  Status,          // active | inactive
    string? RoleName,
    string? BaseRoleKey,     // agent | decision_maker | admin | finance | …
    int     LeadCount,       // how many leads this agent owns — the reason to import them
    string? SuggestedRole,   // the Vrodux role we propose for this agent
    bool    EmailInUse,      // email already belongs to a login (this or another workspace)
    string? EmailInUseNote);

public sealed record PfRoleDto(int Id, string Name, string RoleKey, string BaseRoleKey, bool IsCustom);

/// <summary>
/// The read-only picture of what an import would do — deliberately produced before anything is
/// created, because creating dozens of logins is not something to discover was wrong afterwards.
/// </summary>
public sealed record PfImportPreviewDto(
    IReadOnlyList<PfRoleDto>  Roles,
    IReadOnlyList<PfAgentDto> Agents,
    int TotalPfUsers,
    int ActivePfUsers,
    int AgentsOwningLeads,
    int TotalLeads,
    int LeadsWithKnownAgent,
    int LeadsWithUnknownAgent,   // owning agent no longer exists in PF — cannot be auto-assigned
    int DistinctPeople,          // distinct phone numbers → how many leads a phone-dedupe produces
    int RepeatEnquiries,
    string? OldestLeadAt,
    string? NewestLeadAt);

/// <summary>
/// Maps one Property Finder agent onto the Vrodux user who should own their leads, and the team
/// that user belongs to.
///
/// <para>The team is per-agent, not per-import: with several teams, a lead has to be filed to the
/// team its OWNER is in, or a team lead sees other teams' work — or nothing at all. A single
/// import-wide team would only be correct when there is exactly one.</para>
/// </summary>
public sealed record PfAgentAssignment(int PublicProfileId, Guid UserId, string UserName, Guid? TeamId = null);

public sealed record PfLeadImportResultDto(
    int LeadsFetched,
    int PeopleImported,
    int Created,
    int Duplicates,
    int Failed,
    int EnquiriesLogged,
    int Unassigned,
    IReadOnlyList<string> Errors,
    // ── Batching ──────────────────────────────────────────────────────────────
    // The import runs in slices so it survives a closed tab: each call reports where the caller
    // has reached, and the next call resumes from NextSkip.
    int TotalPeople = 0,
    int NextSkip    = 0,
    bool HasMore    = false);

// ── Live sync ─────────────────────────────────────────────────────────────────

/// <summary>One event subscription registered on the Property Finder side.</summary>
public sealed record PfWebhookDto(string EventId, string Url, string? CreatedAt, bool IsOurs);

/// <summary>
/// Whether new Property Finder enquiries will arrive on their own.
///
/// <see cref="Blocker"/> is the honest answer to "why not yet" — most often that the callback URL
/// is not reachable from the public internet, which no amount of retrying will fix.
/// </summary>
public sealed record PfWebhookStatusDto(
    string? CallbackUrl,
    bool    Live,
    string? Blocker,
    IReadOnlyList<PfWebhookDto> Subscriptions,
    IReadOnlyList<string>       MissingEvents,
    IReadOnlyList<string>       Notes);
