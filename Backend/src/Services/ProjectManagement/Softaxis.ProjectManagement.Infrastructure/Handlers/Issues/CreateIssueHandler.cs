using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.ProjectManagement.Application.Issues.Commands;
using Softaxis.ProjectManagement.Application.Issues.Dtos;
using Softaxis.ProjectManagement.Domain.Entities;
using Softaxis.ProjectManagement.Infrastructure.Persistence;

namespace Softaxis.ProjectManagement.Infrastructure.Handlers.Issues;

internal sealed class CreateIssueHandler(ProjectManagementDbContext db)
    : ICommandHandler<CreateIssueCommand, IssueDto>
{
    public async Task<Result<IssueDto>> Handle(CreateIssueCommand cmd, CancellationToken ct)
    {
        var project = await db.Projects.FindAsync([cmd.ProjectId], ct);
        if (project is null)
            return Result.Failure<IssueDto>(Error.NotFoundById(nameof(Project), cmd.ProjectId));

        var boardColumnId = cmd.BoardColumnId;
        if (boardColumnId is null)
        {
            var defaultColumn = await db.BoardColumns
                .Where(x => x.ProjectId == cmd.ProjectId && x.Category == "todo")
                .OrderBy(x => x.SortOrder)
                .FirstOrDefaultAsync(ct);

            if (defaultColumn is null)
                return Result.Failure<IssueDto>(Error.Custom(
                    "BoardColumn.NotFound", "The project has no 'To Do' board column to place the new issue in."));

            boardColumnId = defaultColumn.Id;
        }
        else
        {
            var columnExists = await db.BoardColumns.AnyAsync(x => x.Id == boardColumnId && x.ProjectId == cmd.ProjectId, ct);
            if (!columnExists)
                return Result.Failure<IssueDto>(Error.NotFoundById(nameof(BoardColumn), boardColumnId.Value));
        }

        var maxSortOrder = await db.Issues
            .Where(x => x.BoardColumnId == boardColumnId)
            .Select(x => (int?)x.SortOrder)
            .MaxAsync(ct);

        var issueKey = project.NextIssueKey();

        var entity = new Issue(
            cmd.ProjectId, issueKey, cmd.Title, cmd.Description, cmd.Type, cmd.Priority,
            boardColumnId.Value, cmd.ReporterName, cmd.AssigneeId, cmd.AssigneeName,
            cmd.Type == "epic" ? null : cmd.EpicId, cmd.SprintId, cmd.StoryPoints, cmd.DueDate,
            (maxSortOrder ?? -1) + 1);

        db.Issues.Add(entity);

        if (cmd.LabelIds is { Count: > 0 })
        {
            foreach (var labelId in cmd.LabelIds.Distinct())
                db.IssueLabels.Add(new IssueLabel(entity.Id, labelId));
        }

        await db.SaveChangesAsync(ct);

        var dto = await IssueMappings.LoadDtoAsync(db, entity.Id, ct);
        return Result.Success(dto!);
    }
}
