using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Domain.Repositories;

namespace Softaxis.Identity.Application.Branches.Commands.DeleteBranch;

public sealed class DeleteBranchCommandHandler(
    IBranchRepository branchRepo,
    IUnitOfWork       uow)
    : ICommandHandler<DeleteBranchCommand>
{
    public async Task<Result> Handle(DeleteBranchCommand cmd, CancellationToken ct)
    {
        var branch = await branchRepo.GetByIdAsync(cmd.Id, ct);
        if (branch is null)
            return Result.Failure(Error.NotFoundById("Branch", cmd.Id));

        branch.Delete();
        await uow.SaveChangesAsync(ct);

        return Result.Success();
    }
}
