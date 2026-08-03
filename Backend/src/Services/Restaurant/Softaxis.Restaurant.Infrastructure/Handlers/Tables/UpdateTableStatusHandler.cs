using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Restaurant.Application.Abstractions;
using Softaxis.Restaurant.Application.Tables.Commands;
using Softaxis.Restaurant.Application.Tables.Dtos;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Handlers.Tables;

internal sealed class UpdateTableStatusHandler(RestaurantDbContext db, IRestaurantRealtimeNotifier realtime)
    : ICommandHandler<UpdateTableStatusCommand, TableDto>
{
    public async Task<Result<TableDto>> Handle(UpdateTableStatusCommand cmd, CancellationToken ct)
    {
        var t = await db.Tables.FindAsync([cmd.Id], ct);
        if (t is null || t.IsDeleted)
            return Result.Failure<TableDto>(Error.NotFoundById("Table", cmd.Id));

        switch (cmd.Status)
        {
            case "available": t.SetAvailable(); break;
            case "reserved":  t.Reserve(); break;
            case "cleaning":  t.Free(); break;
        }

        await db.SaveChangesAsync(ct);
        await realtime.NotifyTablesChangedAsync(ct);

        return Result.Success(TableMappings.ToDto(t));
    }
}
