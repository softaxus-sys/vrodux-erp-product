using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Application.Abstractions;
using Softaxis.Identity.Application.Common;
using Softaxis.Identity.Domain.Repositories;

namespace Softaxis.Identity.Application.Users.Commands.AdminResetPassword;

public sealed class AdminResetPasswordCommandHandler(
    IUserRepository userRepo,
    IPasswordHasher passwordHasher,
    ICurrentUser    currentUser,
    ITenantContext  tenantContext,
    ITenantSecurityPolicyProvider securityPolicy,
    IUnitOfWork     uow)
    : ICommandHandler<AdminResetPasswordCommand>
{
    public async Task<Result> Handle(AdminResetPasswordCommand cmd, CancellationToken ct)
    {
        var user = await userRepo.GetByIdAsync(cmd.UserId, ct);
        if (user is null || !TenantOwnership.CanAccess(currentUser, tenantContext, user.TenantId))
            return Result.Failure(Error.NotFoundById("User", cmd.UserId));

        // The tenant's own password rules (Settings -> Security). Enforced here rather than in the
        // validator because the policy is per-tenant and a FluentValidation rule is static.
        var policy = await securityPolicy.GetAsync(user.TenantId, ct);
        var policyCheck = PasswordPolicy.Validate(cmd.NewPassword, policy);
        if (policyCheck.IsFailure) return policyCheck;

        user.ChangePassword(passwordHasher.Hash(cmd.NewPassword));
        // An administrator-set password is temporary by definition: the user must replace it.
        // ChangePassword clears the flag, so this has to come after it.
        user.RequirePasswordChange();
        userRepo.Update(user);
        await uow.SaveChangesAsync(ct);
        return Result.Success();
    }
}
