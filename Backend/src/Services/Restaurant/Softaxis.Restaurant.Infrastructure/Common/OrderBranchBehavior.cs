using MediatR;
using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Restaurant.Application.Abstractions;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Common;

/// <summary>
/// Runs before every <see cref="IOrderScopedCommand"/>: a user assigned to some branches cannot
/// change an order at another branch, even with its id. Answers NotFound rather than Forbidden so
/// another branch's orders are not confirmed to exist. Unrestricted users pass straight through.
/// </summary>
internal sealed class OrderBranchBehavior<TRequest, TResponse>(RestaurantDbContext db, IBranchAccessGuard branchAccess, LocalBranchGuard localBranch)
    : IPipelineBehavior<TRequest, TResponse>
    where TRequest : notnull
{
    public async Task<TResponse> Handle(TRequest request, RequestHandlerDelegate<TResponse> next, CancellationToken ct)
    {
        if (request is not IOrderScopedCommand cmd) return await next(ct);

        var accessible = await branchAccess.GetAccessibleBranchIdsAsync(ct);

        var branchId = await db.Orders.AsNoTracking()
            .Where(o => o.Id == cmd.OrderId)
            .Select(o => o.BranchId)
            .FirstOrDefaultAsync(ct);

        // A branch that runs on its own server is the only writer of its bills; the cloud refuses.
        if (await localBranch.IsLocalAsync(branchId, ct))
            return Fail(LocalBranchGuard.Refusal());

        if (accessible is null) return await next(ct);

        // Unbranched (legacy) orders stay reachable, matching how they are listed.
        if (branchId is null || accessible.Contains(branchId.Value)) return await next(ct);

        return Fail(Error.NotFoundById("Order", cmd.OrderId));
    }

    private static TResponse Fail(Error error)
    {
        if (typeof(TResponse) == typeof(Result)) return (TResponse)(object)Result.Failure(error);
        var inner = typeof(TResponse).GetGenericArguments().FirstOrDefault();
        if (inner is null) throw new InvalidOperationException("Cannot express a refusal as " + typeof(TResponse).Name);
        var failure = typeof(Result).GetMethod(nameof(Result.Failure), 1, [typeof(Error)])!.MakeGenericMethod(inner);
        return (TResponse)failure.Invoke(null, [error])!;
    }
}
