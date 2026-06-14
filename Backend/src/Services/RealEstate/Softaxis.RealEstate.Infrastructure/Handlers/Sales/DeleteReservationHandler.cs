using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.RealEstate.Application.Sales.Commands;
using Softaxis.RealEstate.Infrastructure.Persistence;

namespace Softaxis.RealEstate.Infrastructure.Handlers.Sales;

internal sealed class DeleteReservationHandler(RealEstateDbContext db)
    : ICommandHandler<DeleteReservationCommand>
{
    public async Task<Result> Handle(DeleteReservationCommand cmd, CancellationToken ct)
    {
        var res = await db.Reservations.FindAsync([cmd.Id], ct);
        if (res is null)
            return Result.Failure(Error.NotFoundById("Reservation", cmd.Id));

        res.Delete();
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
