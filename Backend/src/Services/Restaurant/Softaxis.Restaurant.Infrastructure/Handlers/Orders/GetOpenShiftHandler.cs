using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Restaurant.Application.Orders.Queries;
using Softaxis.Restaurant.Infrastructure.Common;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Handlers.Orders;

internal sealed class GetOpenShiftHandler(RestaurantDbContext db) : IQueryHandler<GetOpenShiftQuery, OpenShiftDto>
{
    public async Task<Result<OpenShiftDto>> Handle(GetOpenShiftQuery query, CancellationToken ct)
    {
        var sessionId = await PosSessionLedger.FindOpenSessionAsync(db, ct);
        return Result.Success(new OpenShiftDto(sessionId.HasValue, sessionId));
    }
}
