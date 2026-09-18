namespace Softaxis.Support.Domain.Entities;

/// <summary>
/// A support request raised by a tenant against the platform operator (Softaxis). This is
/// deliberately a CROSS-TENANT record — it is created by a user of any tenant, but the row
/// itself and its visibility are NOT governed by the platform's usual ambient-tenant isolation
/// (see <c>SupportDbContext</c>, which excludes this whole schema from
/// <c>TenantIsolation.ApplyTenantId</c> on purpose). Instead:
///   - <see cref="RequestingTenantId"/>/<see cref="RequestingTenantName"/> record WHO raised it,
///     as plain reference fields — never a live link into that tenant's own data.
///   - Every query handler applies its own explicit access rule (see the Tickets query handlers
///     and <c>ISupportAccessGuard</c>) rather than relying on any EF global filter, because no
///     single ambient-tenant filter could be correct for both "a customer reading their own
///     tickets" and "a Softaxis agent reading every tenant's queue" at the same time.
/// </summary>
public sealed class SupportTicket
{
    public static readonly IReadOnlyDictionary<string, string[]> Transitions = new Dictionary<string, string[]>
    {
        ["open"]                = ["in_progress", "resolved", "closed"],
        ["in_progress"]         = ["waiting_on_customer", "resolved", "closed"],
        ["waiting_on_customer"] = ["in_progress", "resolved", "closed"],
        ["resolved"]            = ["closed", "in_progress"],
        ["closed"]              = ["in_progress"], // reopened
    };

    private SupportTicket() { }

    public SupportTicket(
        Guid requestingTenantId, string requestingTenantName,
        Guid requestingUserId, string requestingUserName, string requestingUserEmail,
        string subject, string category, string priority)
    {
        Id                   = Guid.NewGuid();
        TicketNumber         = $"TKT-{DateTime.UtcNow:yyyyMMdd}-{Guid.NewGuid().ToString("N")[..6].ToUpperInvariant()}";
        RequestingTenantId   = requestingTenantId;
        RequestingTenantName = requestingTenantName.Trim();
        RequestingUserId     = requestingUserId;
        RequestingUserName   = requestingUserName.Trim();
        RequestingUserEmail  = requestingUserEmail.Trim();
        Subject              = subject.Trim();
        Category             = string.IsNullOrWhiteSpace(category) ? "general" : category;
        Priority             = string.IsNullOrWhiteSpace(priority) ? "medium" : priority;
        Status               = "open";
        CreatedAt            = DateTime.UtcNow;
    }

    public Guid     Id                   { get; private set; }
    public string   TicketNumber         { get; private set; } = string.Empty;

    // Provenance only — the caller's own tenant/user, stamped at creation. Never used as a
    // join/navigation into that tenant's schema (there is none from this service).
    public Guid     RequestingTenantId   { get; private set; }
    public string   RequestingTenantName { get; private set; } = string.Empty;
    public Guid     RequestingUserId     { get; private set; }
    public string   RequestingUserName   { get; private set; } = string.Empty;
    public string   RequestingUserEmail  { get; private set; } = string.Empty;

    public string    Subject      { get; private set; } = string.Empty;
    // billing | technical | feature_request | onboarding | account_security | general
    public string    Category     { get; private set; } = "general";
    // low | medium | high | urgent
    public string    Priority     { get; private set; } = "medium";
    public string     Status              { get; private set; } = "open";
    public Guid?       AssignedToUserId    { get; private set; }
    public string?     AssignedToUserName  { get; private set; }

    public bool      IsDeleted { get; private set; }
    public DateTime  CreatedAt { get; private set; }
    public DateTime? UpdatedAt { get; private set; }
    public DateTime? ClosedAt  { get; private set; }

    /// <summary>Returns false when the transition is not allowed by the status machine.</summary>
    public bool ChangeStatus(string next)
    {
        if (!Transitions.TryGetValue(Status, out var allowed) || !allowed.Contains(next)) return false;
        Status    = next;
        ClosedAt  = next == "closed" ? DateTime.UtcNow : null;
        UpdatedAt = DateTime.UtcNow;
        return true;
    }

    /// <summary>Assign (or unassign with a null id) to an agent. Does not itself change status —
    /// claiming a ticket and starting work are kept as separate, explicit actions.</summary>
    public void Assign(Guid? userId, string? userName)
    {
        AssignedToUserId   = userId;
        AssignedToUserName = string.IsNullOrWhiteSpace(userName) ? null : userName.Trim();
        UpdatedAt           = DateTime.UtcNow;
    }

    public void SetPriority(string priority)
    {
        Priority  = string.IsNullOrWhiteSpace(priority) ? Priority : priority;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Delete() { IsDeleted = true; UpdatedAt = DateTime.UtcNow; }

    /// <summary>Bumps UpdatedAt when a message is added to the thread, so the ticket surfaces in
    /// "most recently active" ordering without a separate query.</summary>
    public void Touch() => UpdatedAt = DateTime.UtcNow;
}
