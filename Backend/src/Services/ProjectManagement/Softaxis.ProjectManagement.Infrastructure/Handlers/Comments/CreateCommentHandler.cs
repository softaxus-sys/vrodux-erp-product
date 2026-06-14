using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.ProjectManagement.Application.Comments.Commands;
using Softaxis.ProjectManagement.Application.Comments.Dtos;
using Softaxis.ProjectManagement.Domain.Entities;
using Softaxis.ProjectManagement.Infrastructure.Persistence;

namespace Softaxis.ProjectManagement.Infrastructure.Handlers.Comments;

internal sealed class CreateCommentHandler(ProjectManagementDbContext db)
    : ICommandHandler<CreateCommentCommand, CommentDto>
{
    public async Task<Result<CommentDto>> Handle(CreateCommentCommand cmd, CancellationToken ct)
    {
        var issueExists = await db.Issues.AnyAsync(x => x.Id == cmd.IssueId, ct);
        if (!issueExists)
            return Result.Failure<CommentDto>(Error.NotFoundById(nameof(Issue), cmd.IssueId));

        var entity = new IssueComment(cmd.IssueId, cmd.AuthorName, cmd.Body);

        db.IssueComments.Add(entity);
        await db.SaveChangesAsync(ct);

        return Result.Success(ToDto(entity));
    }

    internal static CommentDto ToDto(IssueComment c) =>
        new(c.Id, c.IssueId, c.AuthorName, c.Body, c.CreatedAt, c.UpdatedAt);
}
