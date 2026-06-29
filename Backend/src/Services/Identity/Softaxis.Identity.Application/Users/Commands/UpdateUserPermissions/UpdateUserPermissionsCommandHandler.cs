using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Application.Abstractions;
using Softaxis.Identity.Application.Common;
using Softaxis.Identity.Application.DTOs;
using Softaxis.Identity.Domain.Repositories;

namespace Softaxis.Identity.Application.Users.Commands.UpdateUserPermissions;

public sealed class UpdateUserPermissionsCommandHandler(
    IUserRepository       userRepo,
    IPermissionRepository permissionRepo,
    ICurrentUser          currentUser,
    ITenantContext        tenantContext,
    IUnitOfWork           uow)
    : ICommandHandler<UpdateUserPermissionsCommand, UserDto>
{
    public async Task<Result<UserDto>> Handle(UpdateUserPermissionsCommand cmd, CancellationToken ct)
    {
        var user = await userRepo.GetByIdAsync(cmd.UserId, ct);
        if (user is null || !TenantOwnership.CanAccess(currentUser, tenantContext, user.TenantId))
            return Result.Failure<UserDto>(Error.NotFoundById("User", cmd.UserId));

        // Validate every referenced permission id exists (ignore unknown ids).
        var ids   = cmd.Overrides.Select(o => o.PermissionId).Distinct().ToList();
        var valid = (await permissionRepo.GetByIdsAsync(ids, ct)).Select(p => p.Id).ToHashSet();

        var overrides = cmd.Overrides
            .Where(o => valid.Contains(o.PermissionId))
            .Select(o => (o.PermissionId, o.IsGranted));

        user.SetPermissionOverrides(overrides, currentUser.Username ?? currentUser.Email ?? "system");
        userRepo.Update(user);
        await uow.SaveChangesAsync(ct);

        // Reload with full navigation so the returned DTO reflects the saved overrides.
        var updated = await userRepo.GetByIdAsync(user.Id, ct);
        return Result.Success(UserDtoMapper.ToDto(updated ?? user));
    }
}
