using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.ProjectManagement.Application.Projects.Dtos;
using Softaxis.ProjectManagement.Application.Projects.Queries;
using Softaxis.ProjectManagement.Infrastructure.Persistence;
using Softaxis.ProjectManagement.Infrastructure.Services;

namespace Softaxis.ProjectManagement.Infrastructure.Handlers.Projects;

internal sealed class GetProjectsHandler(ProjectManagementDbContext db, IProjectAccessGuard accessGuard)
    : IQueryHandler<GetProjectsQuery, IReadOnlyList<ProjectSummaryDto>>
{
    public async Task<Result<IReadOnlyList<ProjectSummaryDto>>> Handle(GetProjectsQuery query, CancellationToken ct)
    {
        var projects = await accessGuard.AccessibleProjects(db.Projects.AsNoTracking())
            .OrderBy(p => p.Name)
            .Select(p => new
            {
                p.Id, p.Key, p.Name, p.Description, p.Status, p.LeadName, p.CreatedAt,
                Issues = p.Issues.Select(i => i.BoardColumn!.Category),
            })
            .ToListAsync(ct);

        var result = projects.Select(p => new ProjectSummaryDto(
            p.Id, p.Key, p.Name, p.Description, p.Status, p.LeadName,
            TotalIssues:      p.Issues.Count(),
            TodoCount:        p.Issues.Count(c => c is "backlog" or "todo"),
            InProgressCount:  p.Issues.Count(c => c == "in_progress"),
            DoneCount:        p.Issues.Count(c => c == "done"),
            p.CreatedAt
        )).ToList();

        return Result.Success<IReadOnlyList<ProjectSummaryDto>>(result);
    }
}
