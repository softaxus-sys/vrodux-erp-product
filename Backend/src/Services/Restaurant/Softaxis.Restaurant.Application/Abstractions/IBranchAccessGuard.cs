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
}
