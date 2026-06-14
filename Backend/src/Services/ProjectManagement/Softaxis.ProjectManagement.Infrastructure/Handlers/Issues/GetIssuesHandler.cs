using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.ProjectManagement.Application.Issues.Dtos;
using Softaxis.ProjectManagement.Application.Issues.Queries;
using Softaxis.ProjectManagement.Infrastructure.Persistence;

namespace Softaxis.ProjectManagement.Infrastructure.Handlers.Issues;

internal sealed class GetIssuesHandler(ProjectManagementDbContext db)
    : IQueryHandler<GetIssuesQuery, IReadOnlyList<IssueSummaryDto>>
{
    public async Task<Result<IReadOnlyList<IssueSummaryDto>>> Handle(GetIssuesQuery query, CancellationToken ct)
    {
        var q = db.Issues.AsNoTracking().Where(x => x.ProjectId == query.ProjectId);

        if (query.SprintId.HasValue)
            q = q.Where(x => x.SprintId == query.SprintId);

        if (query.BoardColumnId.HasValue)
            q = q.Where(x => x.BoardColumnId == query.BoardColumnId);

        if (!string.IsNullOrWhiteSpace(query.Type))
            q = q.Where(x => x.Type == query.Type);

        if (!string.IsNullOrWhiteSpace(query.AssigneeName))
            q = q.Where(x => x.AssigneeName == query.AssigneeName);

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var term = query.Search.Trim();
            q = q.Where(x => x.Title.Contains(term) || x.IssueKey.Contains(term));
        }

        var items = await q
            .OrderBy(x => x.SortOrder)
            .Select(x => new IssueSummaryDto(
                x.Id, x.ProjectId, x.IssueKey, x.Title, x.Type, x.Priority,
                x.BoardColumnId, x.BoardColumn!.Name, x.BoardColumn!.Category,
                x.AssigneeId, x.AssigneeName, x.ReporterName,
                x.EpicId, x.Epic != null ? x.Epic.IssueKey : null, x.Epic != null ? x.Epic.Title : null,
                x.SprintId, x.StoryPoints, x.DueDate, x.SortOrder, x.ResolvedAt,
                x.IssueLabels.Select(il => new IssueLabelDto(il.Label!.Id, il.Label!.Name, il.Label!.Color)).ToList()))
            .ToListAsync(ct);

        return Result.Success<IReadOnlyList<IssueSummaryDto>>(items);
    }
}
