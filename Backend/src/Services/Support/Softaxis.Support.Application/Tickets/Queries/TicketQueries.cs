using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Support.Application.Tickets.Dtos;

namespace Softaxis.Support.Application.Tickets.Queries;

/// <summary>
/// The caller's OWN tenant's tickets — never a parameter, always resolved from the caller's own
/// JWT (ICurrentUser.TenantId). Any authenticated user in a tenant sees that tenant's whole
/// ticket history (support is a team-wide contact channel, not a per-person inbox), never
/// another tenant's.
/// </summary>
public sealed record GetMyTicketsQuery(string? Status = null) : IQuery<IReadOnlyList<TicketSummaryDto>>;

/// <summary>
/// Agent-side queue — every tenant's tickets. Gated at the controller on `support.tickets.view`
/// AND, inside the handler, on the caller's own tenant being the configured support-operator
/// tenant (see ISupportAccessGuard) — a permission claim alone is not treated as sufficient for
/// a cross-tenant read.
/// </summary>
public sealed record GetTicketQueueQuery(string? Status = null, string? Category = null, Guid? AssignedToUserId = null)
    : IQuery<IReadOnlyList<TicketSummaryDto>>;

public sealed record GetSupportQueueSummaryQuery : IQuery<SupportQueueSummaryDto>;

/// <summary>
/// One ticket's full thread. Access is dual: allowed for an operator-tenant agent holding
/// `support.tickets.view`, OR for any user belonging to the ticket's own requesting tenant.
/// Returns NotFound (never Forbidden) for anyone else, so existence is never leaked.
/// </summary>
public sealed record GetTicketByIdQuery(Guid Id) : IQuery<TicketDetailDto>;

/// <summary>Every candidate assignee — users of the operator tenant holding
/// `support.tickets.edit`. Same operator-tenant + permission gate as the queue itself.</summary>
public sealed record GetSupportAgentsQuery : IQuery<IReadOnlyList<SupportAgentDto>>;
