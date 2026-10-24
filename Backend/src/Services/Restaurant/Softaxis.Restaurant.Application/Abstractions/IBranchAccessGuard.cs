namespace Softaxis.Restaurant.Application.Abstractions;

/// <summary>
/// Resolves which branch(es) the current user may see — mirrors ProjectManagement's
/// IProjectAccessGuard (Module 5g). Opt-in scoping: a user with no UserBranch rows is unrestricted.
/// </summary>
public interface IBranchAccessGuard
{
    /// <summary>Null = unrestricted (every branch, including unbranched records, is visible).
    /// Non-null = the exact set of branch ids this user is scoped to.</summary>
    Task<HashSet<Guid>?> GetAccessibleBranchIdsAsync(CancellationToken ct);

    /// <summary>
    /// The branch set a read should cover: the branch the screen has selected, narrowed to what the
    /// user may see. A branch the user is not assigned to yields an EMPTY set (shows nothing) rather
    /// than falling back to everything. Null = unrestricted and no branch selected ("All Branches").
    /// </summary>
    Task<HashSet<Guid>?> ResolveReadScopeAsync(Guid? requestedBranchId, CancellationToken ct);

    /// <summary>
    /// Whether the user may create or change records in <paramref name="branchId"/>. Null branch is
    /// allowed only for an unrestricted user in a workspace that has no branches.
    /// </summary>
    Task<bool> CanWriteToBranchAsync(Guid? branchId, CancellationToken ct);
}
