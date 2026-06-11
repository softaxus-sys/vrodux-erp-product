using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.RealEstate.Application.Sales.Commands;
using Softaxis.RealEstate.Application.Sales.Dtos;
using Softaxis.RealEstate.Infrastructure.Persistence;

namespace Softaxis.RealEstate.Infrastructure.Handlers.Sales;

internal sealed class RecordBookingPaymentHandler(RealEstateDbContext db)
    : ICommandHandler<RecordBookingPaymentCommand, BookingDto>
{
    public async Task<Result<BookingDto>> Handle(RecordBookingPaymentCommand cmd, CancellationToken ct)
    {
        var b = await db.Bookings.FindAsync([cmd.Id], ct);
        if (b is null)
            return Result.Failure<BookingDto>(Error.NotFoundById("Booking", cmd.Id));

        b.RecordPayment(cmd.Amount);
        await db.SaveChangesAsync(ct);

        return Result.Success(SalesMappings.ToDto(b));
    }
}
