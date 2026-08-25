using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Application.Abstractions;
using Softaxis.Identity.Application.Common;
using Softaxis.Identity.Domain.Repositories;

namespace Softaxis.Identity.Application.Users.Commands.GrantSelfService;

public sealed class GrantSelfServiceCommandHandler(
    IUserRepository userRepo,
    IRoleRepository roleRepo,
    ICurrentUser    currentUser,
    ITenantContext  tenantContext,
    IUnitOfWork     uow)
    : ICommandHandler<GrantSelfServiceCommand>
{
    /// <summary>Must match the name seeded by ModuleRoleCatalogue for the HR module.</summary>
    private const string SelfServiceRoleName = "Employee (Self-Service)";

    public async Task<Result> Handle(GrantSelfServiceCommand cmd, CancellationToken ct)
    {
        // UsersController is [Authorize]-only, so this enforces its own. Same pair of keys as
        // provisioning a login: user administration, or HR handing out employee portal access.
        if (!currentUser.IsSuperAdmin
            && !currentUser.HasPermission("settings.users.create")
            && !currentUser.HasPermission("hr.employees.create-login"))
            return Result.Failure(Error.Custom(
                "Permission.Denied", "You do not have permission to grant portal access."));

        var user = await userRepo.GetByIdAsync(cmd.UserId, ct);
        if (user is null || !TenantOwnership.CanAccess(currentUser, tenantContext, user.TenantId))
            return Result.Failure(Error.NotFoundById("User", cmd.UserId));

        var role = await roleRepo.GetByNameAsync(SelfServiceRoleName, user.TenantId, ct);
        if (role is null)
            return Result.Failure(Error.Custom("Role.NotFound",
                $"This workspace has no \"{SelfServiceRoleName}\" role. Enable the HR module, or grant HR access through Settings → Roles."));

        user.AssignRole(role.Id);   // idempotent on the entity
        userRepo.Update(user);
        await uow.SaveChangesAsync(ct);
        return Result.Success();
    }
}
