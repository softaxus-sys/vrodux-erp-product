using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Restaurant.Application.Reservations.Commands;
using Softaxis.Restaurant.Application.Reservations.Dtos;
using Softaxis.Restaurant.Application.Reservations.Queries;
using Softaxis.Restaurant.Domain.Entities;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Handlers.Reservations;

internal sealed class UpsertReservationRuleHandler(RestaurantDbContext db)
    : ICommandHandler<UpsertReservationRuleCommand, ReservationRuleDto>
{
    public async Task<Result<ReservationRuleDto>> Handle(UpsertReservationRuleCommand cmd, CancellationToken ct)
    {
        var rule = await db.ReservationRules.FirstOrDefaultAsync(x => !x.IsDeleted && x.BranchId == cmd.BranchId, ct);
        if (rule is null)
        {
            rule = new ReservationRule(cmd.BranchId);
            db.ReservationRules.Add(rule);
        }

        rule.Update(cmd.SlotDurationMinutes, cmd.MaxCoversPerSlot, cmd.MaxAdvanceDays,
            cmd.MinNoticeMinutes, cmd.AutoNoShowMinutes, cmd.DepositRequired, cmd.DepositAmount);
        await db.SaveChangesAsync(ct);

        return Result.Success(ToDto(rule));
    }

    internal static ReservationRuleDto ToDto(ReservationRule r) => new(
        r.Id, r.BranchId, r.SlotDurationMinutes, r.MaxCoversPerSlot, r.MaxAdvanceDays,
        r.MinNoticeMinutes, r.AutoNoShowMinutes, r.DepositRequired, r.DepositAmount);
}

internal sealed class GetReservationRuleHandler(RestaurantDbContext db)
    : IQueryHandler<GetReservationRuleQuery, ReservationRuleDto?>
{
    public async Task<Result<ReservationRuleDto?>> Handle(GetReservationRuleQuery query, CancellationToken ct)
    {
        var rule = await db.ReservationRules.AsNoTracking()
            .FirstOrDefaultAsync(x => !x.IsDeleted && x.BranchId == query.BranchId, ct);

        return Result.Success(rule is null ? null : UpsertReservationRuleHandler.ToDto(rule));
    }
}
