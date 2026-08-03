namespace Softaxis.Restaurant.Domain.Entities;

/// <summary>
/// Scopes a user to specific branch(es) for Restaurant's tables/orders/reservations/waitlist —
/// mirrors ProjectMember (Module 5g) / DealContact (Module 8c): a pure association row, hard-deleted
/// on unlink (no IsDeleted — the tenant global filter already applies via the shadow TenantId column).
///
/// A user with ZERO rows here is unrestricted (sees every branch, including unbranched records) — this
/// is opt-in scoping: assigning a UserBranch is what turns branch-scoping ON for that user, so existing
/// single-location tenants (and every user today) are completely unaffected until an admin explicitly
/// assigns someone to a branch.
/// </summary>
public sealed class UserBranch
{
    public Guid Id { get; private set; } = Guid.NewGuid();
    public Guid UserId { get; private set; }
    public string UserName { get; private set; } = null!; // denormalized display name (same pattern as ProjectMember.UserName)
    public Guid BranchId { get; private set; }
    public string Role { get; private set; } = "staff"; // owner/manager/staff
    public DateTime CreatedAt { get; private set; } = DateTime.UtcNow;

    public UserBranch(Guid userId, string userName, Guid branchId, string role)
    {
        UserId = userId; UserName = userName; BranchId = branchId; Role = role;
    }

    public void SetRole(string role) => Role = role;
}
