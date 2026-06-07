using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Application.Abstractions;
using Softaxis.POS.Application.DTOs;
using Softaxis.POS.Domain.Entities;
using Softaxis.POS.Domain.Repositories;

namespace Softaxis.POS.Application.Sessions.Commands.OpenSession;

public sealed class OpenSessionCommandHandler(
    IPOSSessionRepository sessionRepo,
    ICurrentUser          currentUser,
    IUnitOfWork           uow)
    : ICommandHandler<OpenSessionCommand, POSSessionDto>
{
    public async Task<Result<POSSessionDto>> Handle(OpenSessionCommand cmd, CancellationToken ct)
    {
        if (!currentUser.IsAuthenticated || !currentUser.Id.HasValue)
            return Result.Failure<POSSessionDto>(Error.Custom("Session.Unauthorized", "User must be authenticated to open a session."));

        // Enforce one open session per register
        var existing = await sessionRepo.GetActiveByRegisterAsync(cmd.RegisterId, ct);
        if (existing is not null)
            return Result.Failure<POSSessionDto>(Error.Custom("Session.RegisterInUse",
                $"Register '{cmd.RegisterId}' already has an active session."));

        // Enforce one open session per cashier
        var cashierSession = await sessionRepo.GetActiveByUserAsync(currentUser.Id.Value, ct);
        if (cashierSession is not null)
            return Result.Failure<POSSessionDto>(Error.Custom("Session.CashierHasSession",
                "You already have an active POS session. Close it before opening a new one."));

        var result = POSSession.Open(currentUser.Id.Value, cmd.RegisterId, cmd.OpeningCash);
        if (result.IsFailure)
            return Result.Failure<POSSessionDto>(result.Error);

        sessionRepo.Add(result.Value);
        await uow.SaveChangesAsync(ct);

        return Result.Success(MapToDto(result.Value));
    }

    private static POSSessionDto MapToDto(POSSession s) =>
        new(s.Id, s.CashierId, s.RegisterId, s.Status.ToString(),
            s.OpenedAt, s.ClosedAt, s.OpeningCash, s.ClosingCash,
            s.ExpectedCash, s.CashVariance, s.TotalTransactions,
            s.TotalSales, s.TotalRefunds, s.NetSales, s.Notes);
}
