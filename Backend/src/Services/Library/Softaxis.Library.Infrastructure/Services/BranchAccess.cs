using Microsoft.EntityFrameworkCore;
using Softaxis.Library.Application.Abstractions;
using Softaxis.Library.Infrastructure.Persistence;

namespace Softaxis.Library.Infrastructure.Services;

/// <summary>
/// Resolves the current user's branch limits once per request.
///
/// Not limited: super admins; anyone holding <c>library.setup.edit</c> (they decide who works
/// where, and must not be able to lock themselves out by adding their own name to a branch);
/// anyone assigned to no branch; and work with no user at all, such as the reminder job.
/// </summary>
internal sealed class BranchAccess(LibraryDbContext db, ICurrentUser user) : IBranchAccess
{
    private bool _resolved;
    private IReadOnlyCollection<Guid>? _allowed;

    public async Task<IReadOnlyCollection<Guid>?> AllowedBranchIdsAsync(CancellationToken ct)
    {
        if (_resolved) return _allowed;
        _resolved = true;

        if (user.Id is not { } userId || user.IsSuperAdmin || user.HasPermission("library.setup.edit"))
            return _allowed = null;

        // Assignments to a deleted branch do not count: they would leave someone limited to nothing.
        var ids = await (
            from s in db.BranchStaff.AsNoTracking()
            join b in db.Branches.AsNoTracking() on s.BranchId equals b.Id
            where s.UserId == userId && !b.IsDeleted
            select b.Id).Distinct().ToListAsync(ct);

        return _allowed = ids.Count == 0 ? null : ids;
    }
}
