using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Application.Abstractions;
using Softaxis.Identity.Application.DTOs;
using Softaxis.Identity.Domain.Repositories;

namespace Softaxis.Identity.Application.Auth.Commands.IssueServiceToken;

public sealed class IssueServiceTokenCommandHandler(
    IUserRepository       userRepo,
    IPermissionRepository permissionRepo,
    ITenantRepository     tenantRepo,
    IJwtTokenService      jwtService)
    : ICommandHandler<IssueServiceTokenCommand, ServiceTokenDto>
{
    public async Task<Result<ServiceTokenDto>> Handle(IssueServiceTokenCommand cmd, CancellationToken ct)
    {
        var user = await userRepo.GetByIdAsync(cmd.UserId, ct);
        if (user is null || user.IsLocked || !user.EmailVerified)
            return Result.Failure<ServiceTokenDto>(Error.Custom("Auth.ServiceToken.Denied", "User is not eligible for a token."));

        var tenant = user.TenantId.HasValue
            ? await tenantRepo.GetByIdAsync(user.TenantId.Value, ct)
            : null;

        var permKeys    = await permissionRepo.GetPermissionKeysForUserAsync(user.Id, ct);
        var accessToken = jwtService.GenerateAccessToken(user, permKeys, tenant);

        return new ServiceTokenDto(
            accessToken, user.Id, user.Username, user.Email.Value, user.IsSuperAdmin, user.TenantId, permKeys);
    }
}
