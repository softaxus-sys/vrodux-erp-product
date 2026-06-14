using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.ProjectManagement.Application.BoardColumns.Commands;
using Softaxis.ProjectManagement.Application.BoardColumns.Dtos;
using Softaxis.ProjectManagement.Infrastructure.Persistence;

namespace Softaxis.ProjectManagement.Infrastructure.Handlers.BoardColumns;

internal sealed class ReorderBoardColumnsHandler(ProjectManagementDbContext db)
    : ICommandHandler<ReorderBoardColumnsCommand, IReadOnlyList<BoardColumnDto>>
{
    public async Task<Result<IReadOnlyList<BoardColumnDto>>> Handle(ReorderBoardColumnsCommand cmd, CancellationToken ct)
    {
        var ids = cmd.Items.Select(x => x.Id).ToList();
        var entities = await db.BoardColumns
            .Where(x => x.ProjectId == cmd.ProjectId && ids.Contains(x.Id))
            .ToListAsync(ct);

        if (entities.Count != ids.Count)
            return Result.Failure<IReadOnlyList<BoardColumnDto>>(
                Error.Custom("BoardColumn.NotFound", "One or more board columns were not found."));

        var sortOrderById = cmd.Items.ToDictionary(x => x.Id, x => x.SortOrder);
        foreach (var entity in entities)
            entity.Reorder(sortOrderById[entity.Id]);

        await db.SaveChangesAsync(ct);

        var all = await db.BoardColumns
            .AsNoTracking()
            .Where(x => x.ProjectId == cmd.ProjectId)
            .OrderBy(x => x.SortOrder)
            .Select(x => new BoardColumnDto(x.Id, x.ProjectId, x.Name, x.Category, x.SortOrder, x.IsDefault))
            .ToListAsync(ct);

        return Result.Success<IReadOnlyList<BoardColumnDto>>(all);
    }
}
