using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.RealEstate.Application.Sales.Commands;
using Softaxis.RealEstate.Infrastructure.Persistence;

namespace Softaxis.RealEstate.Infrastructure.Handlers.Sales;

internal sealed class SetReservationStatusHandler(RealEstateDbContext db)
    : ICommandHandler<SetReservationStatusCommand>
{
    public async Task<Result> Handle(SetReservationStatusCommand cmd, CancellationToken ct)
    {
        var res = await db.Reservations.FindAsync([cmd.Id], ct);
        if (res is null)
            return Result.Failure(Error.NotFoundById("Reservation", cmd.Id));

        res.SetStatus(cmd.Status);
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
