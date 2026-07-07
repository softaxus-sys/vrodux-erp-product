using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Application.DTOs;
using Softaxis.Identity.Domain.Repositories;

namespace Softaxis.Identity.Application.Users.Queries.GetTwoFactorStatus;

public sealed class GetTwoFactorStatusQueryHandler(IUserRepository userRepo)
    : IQueryHandler<GetTwoFactorStatusQuery, TwoFactorStatusDto>
{
    public async Task<Result<TwoFactorStatusDto>> Handle(GetTwoFactorStatusQuery query, CancellationToken ct)
    {
        var user = await userRepo.GetByIdAsync(query.UserId, ct);
        if (user is null)
            return Result.Failure<TwoFactorStatusDto>(Error.NotFoundById("User", query.UserId));

        return Result.Success(new TwoFactorStatusDto(user.TwoFactorEnabled, user.BackupCodesRemaining));
    }
}
