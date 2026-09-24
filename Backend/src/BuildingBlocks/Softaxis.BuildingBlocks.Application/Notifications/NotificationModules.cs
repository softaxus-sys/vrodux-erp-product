namespace Softaxis.BuildingBlocks.Application.Notifications;

/// <summary>
/// Module keys for <see cref="NotificationRequest.Module"/>. These are the SAME keys the frontend's
/// ModuleKey union and hasModuleAccess() use — they must match exactly, because the feed filters a
/// reader's alerts by the modules they can open.
/// </summary>
public static class NotificationModules
{
    public const string Crm               = "crm";
    public const string Hr                = "hr";
    public const string Finance           = "finance";
    public const string Purchase          = "purchase";
    public const string Sales             = "sales";
    public const string Inventory         = "inventory";
    public const string ProjectManagement = "project-management";
    public const string RealEstate        = "real-estate";
    public const string Visa              = "visa";
    public const string Support           = "support";
    public const string Pos               = "pos";
    public const string Restaurant        = "restaurant";
    public const string Seo               = "seo";
    /// <summary>Account-level alerts (billing, security) — never module-gated, everyone sees their own.</summary>
    public const string System            = "system";
}

/// <summary>
/// Stable event keys. Dotted, lowercase, past tense: "&lt;subject&gt;.&lt;what happened&gt;".
/// Never renamed once shipped — a user's mute list stores these.
/// </summary>
public static class NotificationEvents
{
    public const string LeadAssigned            = "lead.assigned";
    public const string LeadReceived            = "lead.received";
    public const string DealAssigned            = "deal.assigned";
    public const string AccountAssigned         = "account.assigned";
    public const string ActivityAssigned        = "activity.assigned";

    // Supervisory counterparts: the same events seen from one rung up the
    // admin → team lead → team member hierarchy. Separate keys rather than a flag on the originals,
    // so a team lead can mute "what my team was handed" without also muting their own work.
    public const string LeadAssignedToMember    = "lead.assigned-to-member";
    public const string LeadReceivedByMember    = "lead.received-by-member";
    public const string DealAssignedToMember    = "deal.assigned-to-member";
    public const string AccountAssignedToMember = "account.assigned-to-member";

    public const string LeaveRequested          = "leave.requested";
    public const string LeaveApproved           = "leave.approved";
    public const string LeaveRejected           = "leave.rejected";

    public const string PayrollAwaitingFinance  = "payroll.awaiting-finance";
    public const string PayrollApproved         = "payroll.approved";
    public const string PayrollRejected         = "payroll.rejected";

    public const string PurchaseApprovalPending = "purchase-approval.pending";
    public const string PurchaseApprovalDecided = "purchase-approval.decided";

    public const string IssueAssigned           = "issue.assigned";

    // Integration health. Separate keys for the two directions so "it broke" can be kept while
    // "it came back" is muted — the recovery notice is reassurance, the failure is a call to act.
    public const string IntegrationFailing      = "integration.failing";
    public const string IntegrationRecovered    = "integration.recovered";

    public const string SeoFixesReady           = "seo.fixes-ready";
}
