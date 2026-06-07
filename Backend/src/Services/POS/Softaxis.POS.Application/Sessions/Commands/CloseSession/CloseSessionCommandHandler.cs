using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Application.Abstractions;
using Softaxis.POS.Application.DTOs;
using Softaxis.POS.Domain.Entities;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Application.Sessions.Commands.CloseSession;

public sealed class CloseSessionCommandHandler(
    IPOSSessionRepository sessionRepo,
    ICurrentUser          currentUser,
    IUnitOfWork           uow)
    : ICommandHandler<CloseSessionCommand, POSSessionDto>
{
    public async Task<Result<POSSessionDto>> Handle(CloseSessionCommand cmd, CancellationToken ct)
    {
        var session = await sessionRepo.GetByIdAsync(cmd.SessionId, ct);
        if (session is null)
            return Result.Failure<POSSessionDto>(Error.NotFoundById("Session", cmd.SessionId));

        // Verify identity — must be authenticated to close a session
        if (!currentUser.IsAuthenticated || !currentUser.Id.HasValue)
            return Result.Failure<POSSessionDto>(Error.Custom("Session.Unauthorized", "Cannot verify user identity."));

        // Only the owning cashier or a user with close_any permission can close
        if (session.CashierId != currentUser.Id.Value && !currentUser.HasPermission("pos.session.close_any"))
            return Result.Failure<POSSessionDto>(Error.Custom("Session.Forbidden", "You can only close your own sessions."));

        var result = session.Close(cmd.ClosingCash, cmd.Notes);
        if (result.IsFailure)
            return Result.Failure<POSSessionDto>(result.Error);

        sessionRepo.Update(session);
        await uow.SaveChangesAsync(ct);

        return Result.Success(new POSSessionDto(
            session.Id, session.CashierId, session.RegisterId, session.Status.ToString(),
            session.OpenedAt, session.ClosedAt, session.OpeningCash, session.ClosingCash,
            session.ExpectedCash, session.CashVariance, session.TotalTransactions,
            session.TotalSales, session.TotalRefunds, session.NetSales, session.Notes));
    }
}
