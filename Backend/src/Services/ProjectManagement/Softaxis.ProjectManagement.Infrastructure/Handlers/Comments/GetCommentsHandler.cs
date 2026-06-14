using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.ProjectManagement.Application.Comments.Dtos;
using Softaxis.ProjectManagement.Application.Comments.Queries;
using Softaxis.ProjectManagement.Infrastructure.Persistence;

namespace Softaxis.ProjectManagement.Infrastructure.Handlers.Comments;

internal sealed class GetCommentsHandler(ProjectManagementDbContext db)
    : IQueryHandler<GetCommentsQuery, IReadOnlyList<CommentDto>>
{
    public async Task<Result<IReadOnlyList<CommentDto>>> Handle(GetCommentsQuery query, CancellationToken ct)
    {
        var items = await db.IssueComments
            .AsNoTracking()
            .Where(x => x.IssueId == query.IssueId)
            .OrderBy(x => x.CreatedAt)
            .Select(x => new CommentDto(x.Id, x.IssueId, x.AuthorName, x.Body, x.CreatedAt, x.UpdatedAt))
            .ToListAsync(ct);

        return Result.Success<IReadOnlyList<CommentDto>>(items);
    }
}
