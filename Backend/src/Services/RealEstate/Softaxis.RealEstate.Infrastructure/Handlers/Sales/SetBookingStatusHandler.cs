using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.RealEstate.Application.Sales.Commands;
using Softaxis.RealEstate.Infrastructure.Persistence;

namespace Softaxis.RealEstate.Infrastructure.Handlers.Sales;

internal sealed class SetBookingStatusHandler(RealEstateDbContext db)
    : ICommandHandler<SetBookingStatusCommand>
{
    public async Task<Result> Handle(SetBookingStatusCommand cmd, CancellationToken ct)
    {
        var b = await db.Bookings.FindAsync([cmd.Id], ct);
        if (b is null)
            return Result.Failure(Error.NotFoundById("Booking", cmd.Id));

        b.SetStatus(cmd.Status);
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
