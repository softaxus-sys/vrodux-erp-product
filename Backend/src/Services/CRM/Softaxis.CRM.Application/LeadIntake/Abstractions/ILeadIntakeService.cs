using Softaxis.CRM.Application.LeadIntake.Dtos;
using Softaxis.CRM.Domain.Entities.Integrations;

namespace Softaxis.CRM.Application.LeadIntake.Abstractions;

/// <summary>
/// The single funnel every lead flows through, regardless of source:
///   field mapping → duplicate detection → Lead creation → routing/assignment →
///   provenance (LeadSource) → LeadIngestedNotification (automations).
///
/// Providers and the internal API both call this — nobody writes a Lead directly.
/// </summary>
public interface ILeadIntakeService
{
    /// <summary>
    /// Ingest one canonical lead for <paramref name="tenantId"/>. When <paramref name="integration"/>
    /// is supplied its field mapping / dedupe / routing config is applied; pass null for ad-hoc
    /// internal pushes. Must be safe to call from anonymous (webhook) contexts — it stamps the
    /// tenant explicitly rather than relying on the ambient tenant.
    /// </summary>
    Task<IntakeResult> IngestAsync(
        CanonicalLead lead, Guid tenantId, Integration? integration, CancellationToken ct,
        LeadOwner? owner = null);
}

/// <summary>
/// A resolved owner for an incoming lead — a real user id and, with it, the team the record belongs
/// to.
///
/// Routing config can only name an assignee ("Sarah"), which sets <c>Lead.AssignedTo</c> but leaves
/// <c>AssignedToUserId</c> and <c>TeamId</c> null. Since Module 31 a record with no team is visible
/// only to its owner and full-access roles, so a name-only assignment produces a lead that the
/// named person cannot actually find. Callers that know the real user pass this instead.
/// </summary>
public sealed record LeadOwner(Guid UserId, string UserName, Guid? TeamId);
