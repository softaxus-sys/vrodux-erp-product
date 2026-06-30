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
    Task<IntakeResult> IngestAsync(CanonicalLead lead, Guid tenantId, Integration? integration, CancellationToken ct);
}
