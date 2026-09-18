using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Domain.Repositories;

namespace Softaxis.Identity.Application.Auth.Commands.RevokeSession;

public sealed class RevokeSessionCommandHandler(
    IRefreshTokenRepository refreshRepo,
    IUnitOfWork             uow)
    : ICommandHandler<RevokeSessionCommand>
{
    public async Task<Result> Handle(RevokeSessionCommand cmd, CancellationToken ct)
    {
        // Scoped to the caller's own UserId at the repository level, so a guessed session id for
        // another user's session returns NotFound rather than confirming it exists.
        var session = await refreshRepo.GetByIdForUserAsync(cmd.SessionId, cmd.UserId, ct);
        if (session is null)
            return Result.Failure(Error.NotFoundById("Session", cmd.SessionId));

        if (session.IsActive)
        {
            session.Revoke();
            refreshRepo.Update(session);
            await uow.SaveChangesAsync(ct);
        }

        return Result.Success();
    }
}
