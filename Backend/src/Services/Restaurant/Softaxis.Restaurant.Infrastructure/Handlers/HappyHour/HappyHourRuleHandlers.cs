using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Restaurant.Application.HappyHour.Commands;
using Softaxis.Restaurant.Application.HappyHour.Dtos;
using Softaxis.Restaurant.Application.HappyHour.Queries;
using Softaxis.Restaurant.Domain.Entities;
using Softaxis.Restaurant.Infrastructure.Persistence;

namespace Softaxis.Restaurant.Infrastructure.Handlers.HappyHour;

internal static class HappyHourRuleMappings
{
    public static HappyHourRuleDto ToDto(HappyHourRule r) => new(
        r.Id, r.BranchId, r.Name, r.DaysOfWeekMask, r.StartTime, r.EndTime,
        r.DiscountType, r.DiscountValue, r.CategoryId, r.IsActive);
}

internal sealed class CreateHappyHourRuleHandler(RestaurantDbContext db)
    : ICommandHandler<CreateHappyHourRuleCommand, HappyHourRuleDto>
{
    public async Task<Result<HappyHourRuleDto>> Handle(CreateHappyHourRuleCommand cmd, CancellationToken ct)
    {
        var rule = new HappyHourRule(cmd.Name.Trim(), cmd.DaysOfWeekMask, cmd.StartTime, cmd.EndTime,
            cmd.DiscountType, cmd.DiscountValue, cmd.CategoryId, cmd.BranchId);
        db.HappyHourRules.Add(rule);
        await db.SaveChangesAsync(ct);
        return Result.Success(HappyHourRuleMappings.ToDto(rule));
    }
}

internal sealed class UpdateHappyHourRuleHandler(RestaurantDbContext db)
    : ICommandHandler<UpdateHappyHourRuleCommand, HappyHourRuleDto>
{
    public async Task<Result<HappyHourRuleDto>> Handle(UpdateHappyHourRuleCommand cmd, CancellationToken ct)
    {
        var rule = await db.HappyHourRules.FirstOrDefaultAsync(x => x.Id == cmd.Id && !x.IsDeleted, ct);
        if (rule is null) return Result.Failure<HappyHourRuleDto>(Error.NotFoundById("HappyHourRule", cmd.Id));

        rule.Update(cmd.Name.Trim(), cmd.DaysOfWeekMask, cmd.StartTime, cmd.EndTime,
            cmd.DiscountType, cmd.DiscountValue, cmd.CategoryId, cmd.IsActive);
        await db.SaveChangesAsync(ct);
        return Result.Success(HappyHourRuleMappings.ToDto(rule));
    }
}

internal sealed class DeleteHappyHourRuleHandler(RestaurantDbContext db) : ICommandHandler<DeleteHappyHourRuleCommand>
{
    public async Task<Result> Handle(DeleteHappyHourRuleCommand cmd, CancellationToken ct)
    {
        var rule = await db.HappyHourRules.FirstOrDefaultAsync(x => x.Id == cmd.Id && !x.IsDeleted, ct);
        if (rule is null) return Result.Failure(Error.NotFoundById("HappyHourRule", cmd.Id));

        rule.Delete();
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

internal sealed class GetHappyHourRulesHandler(RestaurantDbContext db)
    : IQueryHandler<GetHappyHourRulesQuery, IReadOnlyList<HappyHourRuleDto>>
{
    public async Task<Result<IReadOnlyList<HappyHourRuleDto>>> Handle(GetHappyHourRulesQuery query, CancellationToken ct)
    {
        var items = await db.HappyHourRules.AsNoTracking().Where(x => !x.IsDeleted)
            .OrderBy(x => x.Name)
            .Select(r => new HappyHourRuleDto(r.Id, r.BranchId, r.Name, r.DaysOfWeekMask, r.StartTime, r.EndTime,
                r.DiscountType, r.DiscountValue, r.CategoryId, r.IsActive))
            .ToListAsync(ct);
        return Result.Success<IReadOnlyList<HappyHourRuleDto>>(items);
    }
}
