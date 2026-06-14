using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.RealEstate.Application.Sales.Commands;
using Softaxis.RealEstate.Infrastructure.Persistence;

namespace Softaxis.RealEstate.Infrastructure.Handlers.Sales;

internal sealed class DeleteBookingHandler(RealEstateDbContext db)
    : ICommandHandler<DeleteBookingCommand>
{
    public async Task<Result> Handle(DeleteBookingCommand cmd, CancellationToken ct)
    {
        var b = await db.Bookings.FindAsync([cmd.Id], ct);
        if (b is null)
            return Result.Failure(Error.NotFoundById("Booking", cmd.Id));

        b.Delete();
        await db.SaveChangesAsync(ct);

        return Result.Success();
    }
}
