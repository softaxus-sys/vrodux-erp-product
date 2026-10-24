using Softaxis.BuildingBlocks.Application.Sync;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.POS.Application.Sessions.Commands.CloseSession;
using Softaxis.POS.Application.Sessions.Commands.OpenSession;
using Softaxis.POS.Application.Sessions.Commands.RecordCashMovement;
using Softaxis.POS.Application.Sessions.Commands.SuspendSession;
using Softaxis.POS.Application.Transactions.Commands.CreateSale;
using Softaxis.POS.Application.Transactions.Commands.RefundTransaction;
using Softaxis.POS.Infrastructure.Persistence;

namespace Softaxis.POS.Infrastructure.Services;

/// <summary>
/// Keeps the "one writer" rule true for shifts and sales on the cloud: a branch that runs on its own
/// server (<c>identity.branches.ServerMode = 'local'</c>) is the only place its shifts, sales and cash
/// movements are written. The cloud holds a synced copy and refuses direct writes, from any user.
///
/// <para>
/// Only active when this server is the cloud (<c>BranchSync:Mode = Cloud</c>); a branch server and
/// every ordinary deployment pass straight through. The sync endpoint writes with raw SQL and never
/// reaches a command handler, so it is not blocked. Restaurant has the same rule for orders
/// (<c>LocalBranchGuard</c>); see <c>docs/branch-server-design.md</c> §7.
/// </para>
/// </summary>
internal sealed class LocalBranchBehavior<TRequest, TResponse>(POSDbContext db, IConfiguration configuration)
    : IPipelineBehavior<TRequest, TResponse>
    where TRequest : notnull
{
    private const string Refusal =
        "This branch runs on its own server. Its shifts and sales are handled there - " +
        "head office can see them, but not change them.";

    public async Task<TResponse> Handle(TRequest request, RequestHandlerDelegate<TResponse> next, CancellationToken ct)
    {
        // On a BRANCH server: customers (and their wallet, credit and points) are head-office records that flow
        // down. Creating or changing one here would be overwritten by the next sync, so every customer command is
        // refused (decision 3, docs/branch-server-design.md section 12).
        if (BranchServerMode.IsBranch &&
            (typeof(TRequest).Namespace?.StartsWith("Softaxis.POS.Application.Customers.Commands", StringComparison.Ordinal) == true
             || request is Application.Customers.Credit.SetCreditTermsCommand or Application.Customers.Credit.SetCreditHoldCommand))
            return Fail(BranchServerMode.CustomerRefusal());

        if (!string.Equals(configuration["BranchSync:Mode"], "Cloud", StringComparison.OrdinalIgnoreCase))
            return await next(ct);

        // Which branch does this command touch? Opening a shift names it; everything else names a shift.
        Guid? branchId = null;
        Guid? sessionId = request switch
        {
            OpenSessionCommand c          => Set(ref branchId, c.BranchId),
            CloseSessionCommand c         => c.SessionId,
            SuspendSessionCommand c       => c.SessionId,
            RecordCashMovementCommand c   => c.SessionId,
            CreateSaleCommand c           => c.SessionId,
            RefundTransactionCommand c    => c.SessionId,
            _                             => null,
        };

        // Not a command this guard covers.
        if (request is not (OpenSessionCommand or CloseSessionCommand or SuspendSessionCommand
                            or RecordCashMovementCommand or CreateSaleCommand or RefundTransactionCommand))
            return await next(ct);

        if (branchId is null && sessionId is { } sid)
            branchId = await db.Sessions.AsNoTracking()
                .Where(s => s.Id == sid).Select(s => s.BranchId).FirstOrDefaultAsync(ct);

        if (branchId is null || !await IsLocalAsync(branchId.Value, ct))
            return await next(ct);

        return Fail(Error.Custom("Branch.Conflict", Refusal));
    }

    private static TResponse Fail(Error error)
    {
        if (typeof(TResponse) == typeof(Result)) return (TResponse)(object)Result.Failure(error);

        var inner = typeof(TResponse).GetGenericArguments().FirstOrDefault()
            ?? throw new InvalidOperationException("Cannot express a refusal as " + typeof(TResponse).Name);
        var failure = typeof(Result).GetMethod(nameof(Result.Failure), 1, [typeof(Error)])!.MakeGenericMethod(inner);
        return (TResponse)failure.Invoke(null, [error])!;
    }

    private static Guid? Set(ref Guid? target, Guid? value) { target = value; return null; }

    private async Task<bool> IsLocalAsync(Guid branchId, CancellationToken ct)
    {
        try
        {
            var mode = await db.Database
                .SqlQuery<string?>($"SELECT [ServerMode] AS [Value] FROM [identity].[branches] WHERE [Id] = {branchId}")
                .ToListAsync(ct);
            return string.Equals(mode.FirstOrDefault(), "local", StringComparison.OrdinalIgnoreCase);
        }
        catch
        {
            // Column not there yet (older schema): the branch was cloud-run, so it still is.
            return false;
        }
    }
}
