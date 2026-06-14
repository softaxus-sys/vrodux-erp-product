using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.ProjectManagement.Application.Comments.Commands;
using Softaxis.ProjectManagement.Application.Comments.Dtos;
using Softaxis.ProjectManagement.Domain.Entities;
using Softaxis.ProjectManagement.Infrastructure.Persistence;

namespace Softaxis.ProjectManagement.Infrastructure.Handlers.Comments;

internal sealed class UpdateCommentHandler(ProjectManagementDbContext db)
    : ICommandHandler<UpdateCommentCommand, CommentDto>
{
    public async Task<Result<CommentDto>> Handle(UpdateCommentCommand cmd, CancellationToken ct)
    {
        var entity = await db.IssueComments.FindAsync([cmd.Id], ct);
        if (entity is null)
            return Result.Failure<CommentDto>(Error.NotFoundById(nameof(IssueComment), cmd.Id));

        entity.Edit(cmd.Body);
        await db.SaveChangesAsync(ct);

        return Result.Success(CreateCommentHandler.ToDto(entity));
    }
}
