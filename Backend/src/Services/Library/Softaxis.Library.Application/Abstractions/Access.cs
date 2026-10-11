using Softaxis.BuildingBlocks.Domain.Results;

namespace Softaxis.Library.Application.Abstractions;

/// <summary>The signed-in user, read from the request's token.</summary>
public interface ICurrentUser
{
    Guid?   Id           { get; }
    bool    IsSuperAdmin { get; }
    bool    HasPermission(string permissionKey);
}

/// <summary>
/// Which branches the current user may work at. Staff assigned to one or more branches are
/// limited to them; anyone assigned to none — and anyone who can change library setup — may work
/// at every branch.
/// </summary>
public interface IBranchAccess
{
    /// <summary>The branches the user is limited to, or null when they are not limited.</summary>
    Task<IReadOnlyCollection<Guid>?> AllowedBranchIdsAsync(CancellationToken ct);
}

public static class BranchAccessExtensions
{
    /// <summary>Null when the user may work at <paramref name="branchId"/>; otherwise the refusal.</summary>
    public static async Task<Error?> DeniedAsync(this IBranchAccess access, Guid branchId, CancellationToken ct)
    {
        var allowed = await access.AllowedBranchIdsAsync(ct);
        return allowed is null || allowed.Contains(branchId)
            ? null
            : Error.Custom("Branch.Forbidden", "You are assigned to a different branch, so you cannot do this for that branch.");
    }
}
