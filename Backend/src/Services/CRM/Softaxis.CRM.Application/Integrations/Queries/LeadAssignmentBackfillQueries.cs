using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.CRM.Application.Integrations.Dtos;

namespace Softaxis.CRM.Application.Integrations.Queries;

/// <summary>
/// What an assignment backfill WOULD do to the leads this integration has already created.
///
/// <para>Read-only and deliberately separate from applying it. Assignment decides who sees a
/// record — since Module 31 a lead filed to the wrong team is invisible to the right one — so a
/// bulk rewrite of ownership across a live pipeline is not something to trigger blind.</para>
/// </summary>
/// <param name="IncludeAssigned">
/// Off by default: a lead someone already owns has usually been worked, and taking it from them
/// because a portal map now says otherwise is worse than leaving it. On, it re-points every lead.
/// </param>
public sealed record PreviewLeadAssignmentBackfillQuery(Guid IntegrationId, bool IncludeAssigned = false)
    : IQuery<LeadAssignmentBackfillPreviewDto>;
