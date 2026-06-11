using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.RealEstate.Application.Sales.Commands;
using Softaxis.RealEstate.Application.Sales.Dtos;
using Softaxis.RealEstate.Domain.Entities;
using Softaxis.RealEstate.Infrastructure.Persistence;

namespace Softaxis.RealEstate.Infrastructure.Handlers.Sales;

internal sealed class CreateBookingHandler(RealEstateDbContext db)
    : ICommandHandler<CreateBookingCommand, BookingDto>
{
    public async Task<Result<BookingDto>> Handle(CreateBookingCommand cmd, CancellationToken ct)
    {
        var b = new Booking(cmd.DealId, cmd.CustomerId, cmd.CustomerName, cmd.PropertyId, cmd.UnitId,
            cmd.BookingDate, cmd.SalePrice, cmd.DownPayment, cmd.InstallmentCount, cmd.Broker, cmd.Notes);

        db.Bookings.Add(b);

        var resv = await db.Reservations.Where(x => x.UnitId == cmd.UnitId && x.Status == "active").ToListAsync(ct);
        foreach (var res in resv) res.SetStatus("converted");

        await db.SaveChangesAsync(ct);

        return Result.Success(SalesMappings.ToDto(b));
    }
}
