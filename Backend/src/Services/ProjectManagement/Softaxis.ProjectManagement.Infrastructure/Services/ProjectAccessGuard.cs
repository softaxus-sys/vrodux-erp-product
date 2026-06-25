using Microsoft.EntityFrameworkCore;
using Softaxis.ProjectManagement.Application.Abstractions;
using Softaxis.ProjectManagement.Domain.Entities;
using Softaxis.ProjectManagement.Infrastructure.Persistence;

namespace Softaxis.ProjectManagement.Infrastructure.Services;

/// <summary>
/// Restricts visibility of projects to their members, unless the current user is a
/// super admin or holds the highest-privilege project-management permission.
/// </summary>
public interface IProjectAccessGuard
{
    Task<bool> CanAccessAsync(Guid projectId, CancellationToken ct);

    IQueryable<Project> AccessibleProjects(IQueryable<Project> source);
}

internal sealed class ProjectAccessGuard(ProjectManagementDbContext db, ICurrentUser currentUser) : IProjectAccessGuard
{
    public async Task<bool> CanAccessAsync(Guid projectId, CancellationToken ct)
    {
        if (IsAdmin()) return true;
        if (currentUser.Id is not { } uid) return false;

        return await db.ProjectMembers.AsNoTracking()
            .AnyAsync(m => m.ProjectId == projectId && m.UserId == uid, ct);
    }

    public IQueryable<Project> AccessibleProjects(IQueryable<Project> source)
    {
        if (IsAdmin()) return source;

        if (currentUser.Id is not { } uid)
            return source.Where(_ => false); // can't identify user — return empty rather than matching NULL userId

        return source.Where(p => p.Members.Any(m => m.UserId == uid));
    }

    private bool IsAdmin() =>
        currentUser.IsSuperAdmin || currentUser.HasPermission("project-management.projects.delete");
}
