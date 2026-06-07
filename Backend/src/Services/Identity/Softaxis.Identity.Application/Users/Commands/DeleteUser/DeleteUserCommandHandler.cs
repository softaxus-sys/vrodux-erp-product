using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Application.Abstractions;
using Softaxis.Identity.Application.Common;
using Softaxis.Identity.Domain.Repositories;

namespace Softaxis.Identity.Application.Users.Commands.DeleteUser;

public sealed class DeleteUserCommandHandler(
    IUserRepository         userRepo,
    IRefreshTokenRepository refreshRepo,
    ICurrentUser            currentUser,
    ITenantContext          tenantContext,
    IAuditLogRepository     auditRepo,
    IUnitOfWork             uow)
    : ICommandHandler<DeleteUserCommand>
{
    public async Task<Result> Handle(DeleteUserCommand cmd, CancellationToken ct)
    {
        if (currentUser.Id == cmd.Id)
            return Result.Failure(Error.Custom("User.Delete.Self", "You cannot delete your own account."));

        var user = await userRepo.GetByIdAsync(cmd.Id, ct);
        if (user is null || !TenantOwnership.CanAccess(currentUser, tenantContext, user.TenantId))
            return Result.Failure(Error.NotFoundById("User", cmd.Id));

        // Revoke all active sessions
        await refreshRepo.RevokeAllForUserAsync(cmd.Id, ct);

        userRepo.Remove(user); // Soft delete via BaseDbContext
        auditRepo.Add(new Domain.Entities.AuditLog(currentUser.Id, "DELETE_USER", "User", cmd.Id.ToString(), null, null, null, null, true));
        await uow.SaveChangesAsync(ct);

        return Result.Success();
    }
}
