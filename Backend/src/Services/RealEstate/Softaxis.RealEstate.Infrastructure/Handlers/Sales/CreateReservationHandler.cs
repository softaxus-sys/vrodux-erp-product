using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.RealEstate.Application.Sales.Commands;
using Softaxis.RealEstate.Application.Sales.Dtos;
using Softaxis.RealEstate.Domain.Entities;
using Softaxis.RealEstate.Infrastructure.Persistence;

namespace Softaxis.RealEstate.Infrastructure.Handlers.Sales;

internal sealed class CreateReservationHandler(RealEstateDbContext db)
    : ICommandHandler<CreateReservationCommand, ReservationDto>
{
    public async Task<Result<ReservationDto>> Handle(CreateReservationCommand cmd, CancellationToken ct)
    {
        var res = new Reservation(cmd.LeadId, cmd.DealId, cmd.CustomerId, cmd.CustomerName, cmd.PropertyId,
            cmd.UnitId, cmd.ReservationDate, cmd.ExpiryDate, cmd.TokenAmount, cmd.Notes);

        db.Reservations.Add(res);
        await db.SaveChangesAsync(ct);

        return Result.Success(SalesMappings.ToDto(res));
    }
}
