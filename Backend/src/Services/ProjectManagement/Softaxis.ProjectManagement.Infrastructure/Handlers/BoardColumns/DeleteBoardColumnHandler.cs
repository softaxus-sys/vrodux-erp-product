using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.ProjectManagement.Application.BoardColumns.Commands;
using Softaxis.ProjectManagement.Domain.Entities;
using Softaxis.ProjectManagement.Infrastructure.Persistence;

namespace Softaxis.ProjectManagement.Infrastructure.Handlers.BoardColumns;

internal sealed class DeleteBoardColumnHandler(ProjectManagementDbContext db)
    : ICommandHandler<DeleteBoardColumnCommand>
{
    public async Task<Result> Handle(DeleteBoardColumnCommand cmd, CancellationToken ct)
    {
        var entity = await db.BoardColumns.FindAsync([cmd.Id], ct);
        if (entity is null)
            return Result.Failure(Error.NotFoundById(nameof(BoardColumn), cmd.Id));

        if (entity.IsDefault)
            return Result.Failure(Error.Custom(
                "BoardColumn.IsDefault", "Cannot delete a default board column."));

        var hasIssues = await db.Issues.AnyAsync(x => x.BoardColumnId == cmd.Id, ct);
        if (hasIssues)
            return Result.Failure(Error.Custom(
                "BoardColumn.HasIssues", "Cannot delete a column that still has issues. Move its issues first."));

        db.Remove(entity);
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
