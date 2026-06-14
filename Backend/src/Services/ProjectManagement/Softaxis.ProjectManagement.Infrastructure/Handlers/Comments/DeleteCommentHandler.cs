using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.ProjectManagement.Application.Comments.Commands;
using Softaxis.ProjectManagement.Domain.Entities;
using Softaxis.ProjectManagement.Infrastructure.Persistence;

namespace Softaxis.ProjectManagement.Infrastructure.Handlers.Comments;

internal sealed class DeleteCommentHandler(ProjectManagementDbContext db)
    : ICommandHandler<DeleteCommentCommand>
{
    public async Task<Result> Handle(DeleteCommentCommand cmd, CancellationToken ct)
    {
        var entity = await db.IssueComments.FindAsync([cmd.Id], ct);
        if (entity is null)
            return Result.Failure(Error.NotFoundById(nameof(IssueComment), cmd.Id));

        db.Remove(entity);
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
