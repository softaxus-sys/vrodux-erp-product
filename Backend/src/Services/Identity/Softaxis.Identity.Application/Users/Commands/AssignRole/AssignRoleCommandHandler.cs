using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Application.Abstractions;
using Softaxis.Identity.Application.Common;
using Softaxis.Identity.Domain.Repositories;

namespace Softaxis.Identity.Application.Users.Commands.AssignRole;

public sealed class AssignRoleCommandHandler(
    IUserRepository userRepo,
    IRoleRepository roleRepo,
    ICurrentUser    currentUser,
    ITenantContext  tenantContext,
    IUnitOfWork     uow)
    : ICommandHandler<AssignRoleCommand>
{
    public async Task<Result> Handle(AssignRoleCommand cmd, CancellationToken ct)
    {
        var user = await userRepo.GetByIdAsync(cmd.UserId, ct);
        if (user is null || !TenantOwnership.CanAccess(currentUser, tenantContext, user.TenantId))
            return Result.Failure(Error.NotFoundById("User", cmd.UserId));

        var role = await roleRepo.GetByIdAsync(cmd.RoleId, ct);
        if (role is null) return Result.Failure(Error.NotFoundById("Role", cmd.RoleId));

        user.AssignRole(cmd.RoleId);
        userRepo.Update(user);
        await uow.SaveChangesAsync(ct);
        return Result.Success();
    }
}
