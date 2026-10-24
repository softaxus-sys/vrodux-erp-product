using MediatR;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Restaurant.Application.Abstractions;

namespace Softaxis.Restaurant.Infrastructure.Common;

/// <summary>
/// Runs before every <see cref="IBranchScopedQuery"/> (reports, dashboards). A user assigned to
/// branches must ask for one of them: no branch would mean the whole group, another branch would
/// mean someone else's figures. Unrestricted users (owner, admin) may ask for any branch or none.
/// </summary>
internal sealed class BranchQueryBehavior<TRequest, TResponse>(IBranchAccessGuard branchAccess)
    : IPipelineBehavior<TRequest, TResponse>
    where TRequest : notnull
{
    public async Task<TResponse> Handle(TRequest request, RequestHandlerDelegate<TResponse> next, CancellationToken ct)
    {
        if (request is not IBranchScopedQuery q) return await next(ct);

        var accessible = await branchAccess.GetAccessibleBranchIdsAsync(ct);
        if (accessible is null) return await next(ct);
        if (q.BranchId is Guid b && accessible.Contains(b)) return await next(ct);

        var error = Error.Custom("Branch.Forbidden", q.BranchId is null
            ? "Choose one of your branches to see these figures."
            : "You are not assigned to this branch.");
        if (typeof(TResponse) == typeof(Result)) return (TResponse)(object)Result.Failure(error);
        var inner = typeof(TResponse).GetGenericArguments().FirstOrDefault();
        if (inner is null) return await next(ct);
        var failure = typeof(Result).GetMethod(nameof(Result.Failure), 1, [typeof(Error)])!.MakeGenericMethod(inner);
        return (TResponse)failure.Invoke(null, [error])!;
    }
}
