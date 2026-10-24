using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Restaurant.Application.Abstractions;
using Softaxis.Restaurant.Application.Tables.Commands;
using Softaxis.Restaurant.Application.Tables.Dtos;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Handlers.Tables;

internal sealed class CreateTableHandler(RestaurantDbContext db, IBranchAccessGuard branchAccess)
    : ICommandHandler<CreateTableCommand, TableDto>
{
    public async Task<Result<TableDto>> Handle(CreateTableCommand cmd, CancellationToken ct)
    {
        if (!await branchAccess.CanWriteToBranchAsync(cmd.BranchId, ct))
            return Result.Failure<TableDto>(Error.Custom("Branch.Forbidden", "You are not assigned to this branch."));

        var tableNumber = cmd.TableNumber.Trim();

        // Table numbers repeat across branches ("Table 1" at every branch); unique within one branch.
        var exists = await db.Tables.AnyAsync(x => !x.IsDeleted && x.TableNumber == tableNumber && x.BranchId == cmd.BranchId, ct);
        if (exists)
            return Result.Failure<TableDto>(
                Error.Custom("Table.Duplicate", $"Table '{tableNumber}' already exists."));

        var table = new Domain.Entities.Table(tableNumber, cmd.Section, cmd.Capacity, cmd.BranchId, cmd.DiningAreaId);
        db.Tables.Add(table);
        await db.SaveChangesAsync(ct);

        return Result.Success(TableMappings.ToDto(table));
    }
}
