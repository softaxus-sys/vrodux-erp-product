using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Application.Abstractions;
using Softaxis.Identity.Domain.Repositories;

namespace Softaxis.Identity.Application.Branches.Commands.DeleteBranch;

public sealed class DeleteBranchCommandHandler(
    IBranchRepository branchRepo,
    ICurrentUser      currentUser,
    ITenantContext    tenantContext,
    IUnitOfWork       uow)
    : ICommandHandler<DeleteBranchCommand>
{
    public async Task<Result> Handle(DeleteBranchCommand cmd, CancellationToken ct)
    {
        // Tenants only ever act on their own branches; NotFound so another tenant's row never leaks.
        Guid? tenantScope = currentUser.IsSuperAdmin ? null : tenantContext.TenantId;

        var branch = await branchRepo.GetByIdAsync(cmd.Id, ct);
        if (branch is null || branch.TenantId != tenantScope)
            return Result.Failure(Error.NotFoundById("Branch", cmd.Id));

        branch.Delete();
        await uow.SaveChangesAsync(ct);

        return Result.Success();
    }
}
