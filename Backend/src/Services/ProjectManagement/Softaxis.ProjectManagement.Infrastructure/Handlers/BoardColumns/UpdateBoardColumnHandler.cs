using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.ProjectManagement.Application.BoardColumns.Commands;
using Softaxis.ProjectManagement.Application.BoardColumns.Dtos;
using Softaxis.ProjectManagement.Domain.Entities;
using Softaxis.ProjectManagement.Infrastructure.Persistence;

namespace Softaxis.ProjectManagement.Infrastructure.Handlers.BoardColumns;

internal sealed class UpdateBoardColumnHandler(ProjectManagementDbContext db)
    : ICommandHandler<UpdateBoardColumnCommand, BoardColumnDto>
{
    public async Task<Result<BoardColumnDto>> Handle(UpdateBoardColumnCommand cmd, CancellationToken ct)
    {
        var entity = await db.BoardColumns.FindAsync([cmd.Id], ct);
        if (entity is null)
            return Result.Failure<BoardColumnDto>(Error.NotFoundById(nameof(BoardColumn), cmd.Id));

        entity.Rename(cmd.Name);
        await db.SaveChangesAsync(ct);

        return Result.Success(CreateBoardColumnHandler.ToDto(entity));
    }
}
