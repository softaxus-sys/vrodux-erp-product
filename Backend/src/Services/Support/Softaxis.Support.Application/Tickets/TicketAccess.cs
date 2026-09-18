using Softaxis.Support.Application.Abstractions;
using Softaxis.Support.Domain.Entities;

namespace Softaxis.Support.Application.Tickets;

/// <summary>
/// The single place every handler (and the realtime hub, in the API project — hence public, not
/// internal) asks "can this caller see/act on THIS ticket". Two disjoint populations may reach a
/// given ticket, and neither is a subset of the other:
///   - an operator-tenant agent holding `support.tickets.*` — any ticket, from any tenant;
///   - any user belonging to the ticket's own requesting tenant — their tenant's own tickets only.
/// Kept as one static helper rather than re-derived per caller, since a gap here is a genuine
/// cross-tenant read/write, not a cosmetic bug.
/// </summary>
public static class TicketAccess
{
    // The platform super admin runs the whole product (tenant lifecycle, billing, recycle bin)
    // and is exempt from tenant scoping everywhere else in this codebase — this is the one
    // additional bypass on top of the operator-tenant + permission check, for the rare case a
    // ticket needs platform-level investigation. It is NOT how day-to-day agents work the
    // queue — that is IsOperatorTenantCaller + a real permission grant.
    public static bool CanRead(SupportTicket ticket, ICurrentUser currentUser, ISupportAccessGuard guard) =>
        currentUser.IsSuperAdmin
        || (guard.IsOperatorTenantCaller && currentUser.HasPermission("support.tickets.view"))
        || currentUser.TenantId == ticket.RequestingTenantId;

    public static bool CanReply(SupportTicket ticket, ICurrentUser currentUser, ISupportAccessGuard guard) =>
        currentUser.IsSuperAdmin
        || (guard.IsOperatorTenantCaller && currentUser.HasPermission("support.tickets.edit"))
        || currentUser.TenantId == ticket.RequestingTenantId;

    public static bool IsAgent(ICurrentUser currentUser, ISupportAccessGuard guard) =>
        currentUser.IsSuperAdmin
        || (guard.IsOperatorTenantCaller && currentUser.HasPermission("support.tickets.edit"));
}
