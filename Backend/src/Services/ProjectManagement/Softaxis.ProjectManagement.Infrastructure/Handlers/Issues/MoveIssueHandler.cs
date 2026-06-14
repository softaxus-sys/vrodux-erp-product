using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.ProjectManagement.Application.Issues.Commands;
using Softaxis.ProjectManagement.Application.Issues.Dtos;
using Softaxis.ProjectManagement.Domain.Entities;
using Softaxis.ProjectManagement.Infrastructure.Persistence;

namespace Softaxis.ProjectManagement.Infrastructure.Handlers.Issues;

internal sealed class MoveIssueHandler(ProjectManagementDbContext db)
    : ICommandHandler<MoveIssueCommand, IssueDto>
{
    public async Task<Result<IssueDto>> Handle(MoveIssueCommand cmd, CancellationToken ct)
    {
        var entity = await db.Issues.FindAsync([cmd.Id], ct);
        if (entity is null)
            return Result.Failure<IssueDto>(Error.NotFoundById(nameof(Issue), cmd.Id));

        var column = await db.BoardColumns.FindAsync([cmd.BoardColumnId], ct);
        if (column is null || column.ProjectId != entity.ProjectId)
            return Result.Failure<IssueDto>(Error.NotFoundById(nameof(BoardColumn), cmd.BoardColumnId));

        entity.MoveToColumn(cmd.BoardColumnId, cmd.SortOrder, column.Category == "done");
        await db.SaveChangesAsync(ct);

        var dto = await IssueMappings.LoadDtoAsync(db, entity.Id, ct);
        return Result.Success(dto!);
    }
}
