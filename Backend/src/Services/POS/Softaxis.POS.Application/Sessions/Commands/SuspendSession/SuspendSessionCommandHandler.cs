using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Application.Abstractions;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Application.Sessions.Commands.SuspendSession;

public sealed class SuspendSessionCommandHandler(
    IPOSSessionRepository sessionRepo,
    ICurrentUser          currentUser,
    IUnitOfWork           uow)
    : ICommandHandler<SuspendSessionCommand>
{
    public async Task<Result> Handle(SuspendSessionCommand cmd, CancellationToken ct)
    {
        var session = await sessionRepo.GetByIdAsync(cmd.SessionId, ct);
        if (session is null)
            return Result.Failure(Error.NotFoundById("Session", cmd.SessionId));

        if (session.CashierId != currentUser.Id && !currentUser.HasPermission("pos.session.manage"))
            return Result.Failure(Error.Custom("Session.Forbidden", "Insufficient permissions."));

        var result = session.Suspend(cmd.Notes);
        if (result.IsFailure)
            return result;

        sessionRepo.Update(session);
        await uow.SaveChangesAsync(ct);

        return Result.Success();
    }
}
