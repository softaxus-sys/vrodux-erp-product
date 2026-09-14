using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Pagination;
using Softaxis.CRM.Application.Integrations.Dtos;

namespace Softaxis.CRM.Application.Integrations.Queries;

/// <summary>
/// Tenant-wide inbound feed across every integration (the Lead Inbox page), as opposed to
/// <see cref="GetIntegrationInboxQuery"/>, which is one integration's tab inside the configure
/// drawer. Paged in SQL: a portal that pushes every enquiry fills this table quickly, and the
/// per-integration query's flat Take(200) would quietly hide everything older.
/// </summary>
/// <param name="ProviderKey">A provider key ("bayut", "property-finder", …), or null for all.</param>
/// <param name="Status">pending | processing | processed | duplicate | failed.</param>
/// <param name="Search">Matches the provider's external id or the raw payload text.</param>
public sealed record GetLeadInboxQuery(
    int     Page        = 1,
    int     PageSize    = 25,
    string? ProviderKey = null,
    string? Status      = null,
    string? Search      = null
) : IQuery<PagedResult<LeadInboxRowDto>>;

/// <summary>One inbound delivery, including the raw payload exactly as the provider sent it.</summary>
public sealed record GetLeadInboxEntryQuery(Guid Id) : IQuery<LeadInboxEntryDto>;

/// <summary>Counts per status for the page's filter chips, over the same tenant-wide set.</summary>
public sealed record GetLeadInboxSummaryQuery() : IQuery<LeadInboxSummaryDto>;
