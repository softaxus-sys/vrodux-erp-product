using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Application.Abstractions;
using Softaxis.Identity.Application.Common;
using Softaxis.Identity.Application.DTOs;
using Softaxis.Identity.Domain.Repositories;

namespace Softaxis.Identity.Application.Users.Queries.GetUserById;

public sealed class GetUserByIdQueryHandler(
    IUserRepository userRepo,
    ICurrentUser    currentUser,
    ITenantContext  tenantContext)
    : IQueryHandler<GetUserByIdQuery, UserDto>
{
    public async Task<Result<UserDto>> Handle(GetUserByIdQuery query, CancellationToken ct)
    {
        var user = await userRepo.GetByIdAsync(query.Id, ct);
        // Cross-tenant access → treat as not found (don't leak existence).
        if (user is null || !TenantOwnership.CanAccess(currentUser, tenantContext, user.TenantId))
            return Result.Failure<UserDto>(Error.NotFoundById("User", query.Id));

        return Result.Success(UserDtoMapper.ToDto(user));
    }
}
