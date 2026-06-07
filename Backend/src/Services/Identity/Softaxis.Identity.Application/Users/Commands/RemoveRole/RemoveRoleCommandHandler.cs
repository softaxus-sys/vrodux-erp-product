using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Application.Abstractions;
using Softaxis.Identity.Application.Common;
using Softaxis.Identity.Domain.Repositories;

namespace Softaxis.Identity.Application.Users.Commands.RemoveRole;

public sealed class RemoveRoleCommandHandler(
    IUserRepository userRepo,
    ICurrentUser    currentUser,
    ITenantContext  tenantContext,
    IUnitOfWork     uow)
    : ICommandHandler<RemoveRoleCommand>
{
    public async Task<Result> Handle(RemoveRoleCommand cmd, CancellationToken ct)
    {
        var user = await userRepo.GetByIdAsync(cmd.UserId, ct);
        if (user is null || !TenantOwnership.CanAccess(currentUser, tenantContext, user.TenantId))
            return Result.Failure(Error.NotFoundById("User", cmd.UserId));

        user.RemoveRole(cmd.RoleId);
        userRepo.Update(user);
        await uow.SaveChangesAsync(ct);
        return Result.Success();
    }
}
