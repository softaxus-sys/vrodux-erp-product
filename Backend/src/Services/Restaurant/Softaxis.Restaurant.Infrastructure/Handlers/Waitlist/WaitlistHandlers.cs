using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Restaurant.Application.Abstractions;
using Softaxis.Restaurant.Application.Waitlist.Commands;
using Softaxis.Restaurant.Application.Waitlist.Dtos;
using Softaxis.Restaurant.Application.Waitlist.Queries;
using Softaxis.Restaurant.Infrastructure.Common;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Handlers.Waitlist;

internal static class WaitlistMappings
{
    public static WaitlistEntryDto ToDto(Domain.Entities.WaitlistEntry w) => new(
        w.Id, w.BranchId, w.GuestName, w.GuestPhone, w.PartySize, w.QuotedWaitMinutes,
        w.Status, w.ArrivedAt, w.SeatedAt, w.TableId, w.Notes,
        (int)(DateTime.UtcNow - w.ArrivedAt).TotalMinutes);
}

internal sealed class CreateWaitlistEntryHandler(RestaurantDbContext db)
    : ICommandHandler<CreateWaitlistEntryCommand, WaitlistEntryDto>
{
    public async Task<Result<WaitlistEntryDto>> Handle(CreateWaitlistEntryCommand cmd, CancellationToken ct)
    {
        var entry = new Domain.Entities.WaitlistEntry(
            cmd.GuestName, cmd.GuestPhone, cmd.PartySize, cmd.QuotedWaitMinutes, cmd.Notes, cmd.BranchId);
        db.WaitlistEntries.Add(entry);
        await db.SaveChangesAsync(ct);
        return Result.Success(WaitlistMappings.ToDto(entry));
    }
}

internal sealed class SeatWaitlistEntryHandler(RestaurantDbContext db)
    : ICommandHandler<SeatWaitlistEntryCommand, WaitlistEntryDto>
{
    public async Task<Result<WaitlistEntryDto>> Handle(SeatWaitlistEntryCommand cmd, CancellationToken ct)
    {
        var entry = await db.WaitlistEntries.FirstOrDefaultAsync(x => x.Id == cmd.Id && !x.IsDeleted, ct);
        if (entry is null)
            return Result.Failure<WaitlistEntryDto>(Error.Custom("Waitlist.NotFound", "Waitlist entry not found."));
        if (entry.Status != "waiting")
            return Result.Failure<WaitlistEntryDto>(Error.Custom("Waitlist.Conflict", "Only a waiting entry can be seated."));

        var table = await db.Tables.FirstOrDefaultAsync(x => x.Id == cmd.TableId && !x.IsDeleted, ct);
        if (table is null)
            return Result.Failure<WaitlistEntryDto>(Error.Custom("Table.NotFound", "Table not found."));

        entry.Seat(table.Id);
        await db.SaveChangesAsync(ct);
        return Result.Success(WaitlistMappings.ToDto(entry));
    }
}

internal sealed class CancelWaitlistEntryHandler(RestaurantDbContext db)
    : ICommandHandler<CancelWaitlistEntryCommand, WaitlistEntryDto>
{
    public async Task<Result<WaitlistEntryDto>> Handle(CancelWaitlistEntryCommand cmd, CancellationToken ct)
    {
        var entry = await db.WaitlistEntries.FirstOrDefaultAsync(x => x.Id == cmd.Id && !x.IsDeleted, ct);
        if (entry is null)
            return Result.Failure<WaitlistEntryDto>(Error.Custom("Waitlist.NotFound", "Waitlist entry not found."));

        entry.Cancel();
        await db.SaveChangesAsync(ct);
        return Result.Success(WaitlistMappings.ToDto(entry));
    }
}

internal sealed class MarkWaitlistNoShowHandler(RestaurantDbContext db)
    : ICommandHandler<MarkWaitlistNoShowCommand, WaitlistEntryDto>
{
    public async Task<Result<WaitlistEntryDto>> Handle(MarkWaitlistNoShowCommand cmd, CancellationToken ct)
    {
        var entry = await db.WaitlistEntries.FirstOrDefaultAsync(x => x.Id == cmd.Id && !x.IsDeleted, ct);
        if (entry is null)
            return Result.Failure<WaitlistEntryDto>(Error.Custom("Waitlist.NotFound", "Waitlist entry not found."));

        entry.NoShow();
        await db.SaveChangesAsync(ct);
        return Result.Success(WaitlistMappings.ToDto(entry));
    }
}

internal sealed class GetWaitlistHandler(RestaurantDbContext db, IBranchAccessGuard branchAccess)
    : IQueryHandler<GetWaitlistQuery, IReadOnlyList<WaitlistEntryDto>>
{
    public async Task<Result<IReadOnlyList<WaitlistEntryDto>>> Handle(GetWaitlistQuery query, CancellationToken ct)
    {
        var accessible = await branchAccess.GetAccessibleBranchIdsAsync(ct);
        var q = BranchScope.Apply(db.WaitlistEntries.AsNoTracking().Where(x => !x.IsDeleted), accessible);
        if (!string.IsNullOrEmpty(query.Status)) q = q.Where(x => x.Status == query.Status);

        var items = await q.OrderByDescending(x => x.ArrivedAt).ToListAsync(ct);
        return Result.Success<IReadOnlyList<WaitlistEntryDto>>(items.Select(WaitlistMappings.ToDto).ToList());
    }
}

internal sealed class GetWaitlistSummaryHandler(RestaurantDbContext db, IBranchAccessGuard branchAccess)
    : IQueryHandler<GetWaitlistSummaryQuery, WaitlistSummaryDto>
{
    public async Task<Result<WaitlistSummaryDto>> Handle(GetWaitlistSummaryQuery query, CancellationToken ct)
    {
        var accessible = await branchAccess.GetAccessibleBranchIdsAsync(ct);
        var all = await BranchScope.Apply(db.WaitlistEntries.AsNoTracking().Where(x => !x.IsDeleted), accessible).ToListAsync(ct);
        var waiting = all.Where(x => x.Status == "waiting").ToList();

        return Result.Success(new WaitlistSummaryDto(
            all.Count,
            waiting.Count,
            all.Count(x => x.Status == "seated"),
            all.Count(x => x.Status == "no_show"),
            all.Count(x => x.Status == "cancelled"),
            waiting.Count > 0 ? waiting.Average(x => x.QuotedWaitMinutes) : 0));
    }
}
