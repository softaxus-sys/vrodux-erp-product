using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Application.Abstractions;
using Softaxis.Identity.Application.Common;
using Softaxis.Identity.Application.DTOs;
using Softaxis.Identity.Domain.Repositories;

namespace Softaxis.Identity.Application.Users.Commands.UpdateUser;

public sealed class UpdateUserCommandHandler(
    IUserRepository userRepo,
    ICurrentUser    currentUser,
    ITenantContext  tenantContext,
    IUnitOfWork     uow)
    : ICommandHandler<UpdateUserCommand, UserDto>
{
    public async Task<Result<UserDto>> Handle(UpdateUserCommand cmd, CancellationToken ct)
    {
        var user = await userRepo.GetByIdAsync(cmd.Id, ct);
        if (user is null || !TenantOwnership.CanAccess(currentUser, tenantContext, user.TenantId))
            return Result.Failure<UserDto>(Error.NotFoundById("User", cmd.Id));

        user.UpdateProfile(cmd.FirstName, cmd.LastName, cmd.PhoneNumber, cmd.AvatarUrl);
        userRepo.Update(user);
        await uow.SaveChangesAsync(ct);

        return Result.Success(UserDtoMapper.ToDto(user));
    }
}
