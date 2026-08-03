using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Restaurant.Application.Tables.Commands;
using Softaxis.Restaurant.Application.Tables.Dtos;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Handlers.Tables;

internal sealed class CreateTableHandler(RestaurantDbContext db)
    : ICommandHandler<CreateTableCommand, TableDto>
{
    public async Task<Result<TableDto>> Handle(CreateTableCommand cmd, CancellationToken ct)
    {
        var tableNumber = cmd.TableNumber.Trim();

        var exists = await db.Tables.AnyAsync(x => !x.IsDeleted && x.TableNumber == tableNumber, ct);
        if (exists)
            return Result.Failure<TableDto>(
                Error.Custom("Table.Duplicate", $"Table '{tableNumber}' already exists."));

        var table = new Domain.Entities.Table(tableNumber, cmd.Section, cmd.Capacity, cmd.BranchId, cmd.DiningAreaId);
        db.Tables.Add(table);
        await db.SaveChangesAsync(ct);

        return Result.Success(TableMappings.ToDto(table));
    }
}
