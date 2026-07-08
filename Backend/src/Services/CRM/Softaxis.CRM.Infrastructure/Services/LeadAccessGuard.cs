using Microsoft.EntityFrameworkCore;
using Softaxis.CRM.Application.Abstractions;
using Softaxis.CRM.Domain.Entities;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Services;

/// <summary>
/// Role-based lead visibility/edit scoping. Two tiers of access:
///   • Full   — <c>crm.leads.view</c> / <c>crm.leads.edit</c> (or super admin): every lead in the tenant.
///   • Assigned — <c>crm.leads-assigned.view</c> / <c>crm.leads-assigned.edit</c>: only leads whose
///     <see cref="Lead.AssignedToUserId"/> is the current user.
/// A user can hold either, both, or (for assigned-only roles) just the assigned tier. Admins see everything.
/// </summary>
public interface ILeadAccessGuard
{
    bool CanViewAll      { get; }
    bool CanViewAssigned { get; }
    bool CanEditAll      { get; }
    bool CanEditAssigned { get; }

    /// <summary>Narrow a lead query to the rows the current user may read.</summary>
    IQueryable<Lead> ScopeReadable(IQueryable<Lead> source);

    /// <summary>True if the current user may read this specific lead.</summary>
    bool CanRead(Lead lead);

    /// <summary>True if the current user may edit/act on this specific lead
    /// (full edit, or assigned-edit when the lead is theirs).</summary>
    bool CanEdit(Lead lead);

    /// <summary>True if the current user may create/edit/complete a CRM activity related to the
    /// given record. Full lead-managers may act on anything; assigned-only users only on activities
    /// tied to a lead they own.</summary>
    Task<bool> CanManageActivityAsync(string? relatedToType, Guid relatedToId, CancellationToken ct);

    /// <summary>Narrow an activity query to what the current user may read. Full-view users see all;
    /// assigned-only users see only activities tied to a lead they own.</summary>
    IQueryable<Activity> ScopeActivities(IQueryable<Activity> source);
}

internal sealed class LeadAccessGuard(CrmDbContext db, ICurrentUser user) : ILeadAccessGuard
{
    public bool CanViewAll      => user.IsSuperAdmin || user.HasPermission("crm.leads.view");
    public bool CanViewAssigned => user.HasPermission("crm.leads-assigned.view");
    public bool CanEditAll      => user.IsSuperAdmin || user.HasPermission("crm.leads.edit");
    public bool CanEditAssigned => user.HasPermission("crm.leads-assigned.edit");

    // Full activity managers: super admins and holders of the tenant-wide lead create/edit keys.
    private bool CanManageActivitiesFreely =>
        user.IsSuperAdmin || user.HasPermission("crm.leads.create") || user.HasPermission("crm.leads.edit");

    // Full activity visibility: preserves the pre-existing "crm.leads.view gates all activity reads" rule.
    private bool CanSeeAllActivities => user.IsSuperAdmin || user.HasPermission("crm.leads.view");

    public IQueryable<Lead> ScopeReadable(IQueryable<Lead> source)
    {
        if (CanViewAll) return source;
        if (CanViewAssigned && user.Id is { } uid)
            return source.Where(l => l.AssignedToUserId == uid);
        // No view rights at all (or unidentifiable user) → see nothing.
        return source.Where(_ => false);
    }

    public bool CanRead(Lead lead)
    {
        if (CanViewAll) return true;
        // An assigned-tier user can also read a lead they can edit (their own).
        if ((CanViewAssigned || CanEditAssigned) && user.Id is { } uid && lead.AssignedToUserId == uid) return true;
        return false;
    }

    public bool CanEdit(Lead lead)
    {
        if (CanEditAll) return true;
        if (CanEditAssigned && user.Id is { } uid && lead.AssignedToUserId == uid) return true;
        return false;
    }

    public async Task<bool> CanManageActivityAsync(string? relatedToType, Guid relatedToId, CancellationToken ct)
    {
        if (CanManageActivitiesFreely) return true;
        // Assigned-only users may only work activities tied to a lead they currently own.
        if (CanEditAssigned && string.Equals(relatedToType, "lead", StringComparison.OrdinalIgnoreCase)
            && user.Id is { } uid)
            return await db.Leads.AsNoTracking().AnyAsync(l => l.Id == relatedToId && l.AssignedToUserId == uid, ct);
        return false;
    }

    public IQueryable<Activity> ScopeActivities(IQueryable<Activity> source)
    {
        if (CanSeeAllActivities) return source;
        if (user.Id is { } uid)
            return source.Where(a => a.RelatedToType == "lead"
                && db.Leads.Any(l => l.Id == a.RelatedToId && l.AssignedToUserId == uid));
        return source.Where(_ => false);
    }
}
