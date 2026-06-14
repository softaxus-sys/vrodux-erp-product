using Microsoft.EntityFrameworkCore;
using Softaxis.ProjectManagement.Application.Issues.Dtos;
using Softaxis.ProjectManagement.Infrastructure.Persistence;

namespace Softaxis.ProjectManagement.Infrastructure.Handlers.Issues;

internal static class IssueMappings
{
    public static async Task<IssueDto?> LoadDtoAsync(ProjectManagementDbContext db, Guid issueId, CancellationToken ct)
    {
        var issue = await db.Issues
            .AsNoTracking()
            .Where(x => x.Id == issueId)
            .Select(x => new IssueDto(
                x.Id, x.ProjectId, x.IssueKey, x.Title, x.Description, x.Type, x.Priority,
                x.BoardColumnId, x.BoardColumn!.Name, x.BoardColumn!.Category,
                x.AssigneeId, x.AssigneeName, x.ReporterName,
                x.EpicId, x.Epic != null ? x.Epic.IssueKey : null, x.Epic != null ? x.Epic.Title : null,
                x.SprintId, x.Sprint != null ? x.Sprint.Name : null,
                x.StoryPoints, x.DueDate, x.SortOrder, x.ResolvedAt,
                x.CreatedAt, x.UpdatedAt,
                x.IssueLabels.Select(il => new IssueLabelDto(il.Label!.Id, il.Label!.Name, il.Label!.Color)).ToList(),
                x.Comments.Count))
            .FirstOrDefaultAsync(ct);

        return issue;
    }
}
