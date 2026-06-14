using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.ProjectManagement.Application.BoardColumns.Dtos;
using Softaxis.ProjectManagement.Application.BoardColumns.Queries;
using Softaxis.ProjectManagement.Infrastructure.Persistence;

namespace Softaxis.ProjectManagement.Infrastructure.Handlers.BoardColumns;

internal sealed class GetBoardColumnsHandler(ProjectManagementDbContext db)
    : IQueryHandler<GetBoardColumnsQuery, IReadOnlyList<BoardColumnDto>>
{
    public async Task<Result<IReadOnlyList<BoardColumnDto>>> Handle(GetBoardColumnsQuery query, CancellationToken ct)
    {
        var items = await db.BoardColumns
            .AsNoTracking()
            .Where(x => x.ProjectId == query.ProjectId)
            .OrderBy(x => x.SortOrder)
            .Select(x => new BoardColumnDto(x.Id, x.ProjectId, x.Name, x.Category, x.SortOrder, x.IsDefault))
            .ToListAsync(ct);

        return Result.Success<IReadOnlyList<BoardColumnDto>>(items);
    }
}
