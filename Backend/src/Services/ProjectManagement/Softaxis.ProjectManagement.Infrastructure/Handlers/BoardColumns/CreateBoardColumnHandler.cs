using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.ProjectManagement.Application.BoardColumns.Commands;
using Softaxis.ProjectManagement.Application.BoardColumns.Dtos;
using Softaxis.ProjectManagement.Domain.Entities;
using Softaxis.ProjectManagement.Infrastructure.Persistence;

namespace Softaxis.ProjectManagement.Infrastructure.Handlers.BoardColumns;

internal sealed class CreateBoardColumnHandler(ProjectManagementDbContext db)
    : ICommandHandler<CreateBoardColumnCommand, BoardColumnDto>
{
    public async Task<Result<BoardColumnDto>> Handle(CreateBoardColumnCommand cmd, CancellationToken ct)
    {
        var projectExists = await db.Projects.AnyAsync(x => x.Id == cmd.ProjectId, ct);
        if (!projectExists)
            return Result.Failure<BoardColumnDto>(Error.NotFoundById(nameof(Project), cmd.ProjectId));

        var maxSortOrder = await db.BoardColumns
            .Where(x => x.ProjectId == cmd.ProjectId)
            .Select(x => (int?)x.SortOrder)
            .MaxAsync(ct);

        var entity = new BoardColumn(cmd.ProjectId, cmd.Name, cmd.Category, (maxSortOrder ?? -1) + 1);

        db.BoardColumns.Add(entity);
        await db.SaveChangesAsync(ct);

        return Result.Success(ToDto(entity));
    }

    internal static BoardColumnDto ToDto(BoardColumn c) =>
        new(c.Id, c.ProjectId, c.Name, c.Category, c.SortOrder, c.IsDefault);
}
