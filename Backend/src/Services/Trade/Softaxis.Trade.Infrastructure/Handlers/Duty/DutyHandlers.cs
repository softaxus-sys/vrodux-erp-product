using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Trade.Application.Duty;
using Softaxis.Trade.Domain.Entities;
using Softaxis.Trade.Infrastructure.Handlers.Shipments;
using Softaxis.Trade.Infrastructure.Persistence;

namespace Softaxis.Trade.Infrastructure.Handlers.Duty;

internal static class DutyMapping
{
    public static DutyRateDto ToDto(HsDutyRate r) => new(r.Id, r.HsCode, r.Description, r.DutyPercent, r.Notes);
}

internal sealed class GetDutyRatesHandler(TradeDbContext db) : IQueryHandler<GetDutyRatesQuery, IReadOnlyList<DutyRateDto>>
{
    public async Task<Result<IReadOnlyList<DutyRateDto>>> Handle(GetDutyRatesQuery q, CancellationToken ct)
    {
        var query = db.DutyRates.AsNoTracking().Where(r => !r.IsDeleted);
        if (!string.IsNullOrWhiteSpace(q.Search))
        {
            var s = q.Search.Trim();
            var digits = HsDutyRate.Digits(s);
            query = query.Where(r => r.HsCode.Contains(s) || (r.Description != null && r.Description.Contains(s))
                                  || (digits != "" && r.HsDigits.StartsWith(digits)));
        }
        var rates = await query.OrderBy(r => r.HsDigits).Take(1000).ToListAsync(ct);
        return Result.Success<IReadOnlyList<DutyRateDto>>(rates.Select(DutyMapping.ToDto).ToList());
    }
}

internal sealed class CreateDutyRateHandler(TradeDbContext db) : ICommandHandler<CreateDutyRateCommand, DutyRateDto>
{
    public async Task<Result<DutyRateDto>> Handle(CreateDutyRateCommand cmd, CancellationToken ct)
    {
        var i = cmd.Rate;
        var digits = HsDutyRate.Digits(i.HsCode);
        if (await db.DutyRates.AnyAsync(r => !r.IsDeleted && r.HsDigits == digits, ct))
            return Result.Failure<DutyRateDto>(Error.Custom("DutyRate.Duplicate", $"A rate for {i.HsCode.Trim()} already exists. Edit it instead."));

        var rate = new HsDutyRate(i.HsCode, i.Description, i.DutyPercent, i.Notes);
        db.DutyRates.Add(rate);
        await db.SaveChangesAsync(ct);
        return Result.Success(DutyMapping.ToDto(rate));
    }
}

internal sealed class UpdateDutyRateHandler(TradeDbContext db) : ICommandHandler<UpdateDutyRateCommand, DutyRateDto>
{
    public async Task<Result<DutyRateDto>> Handle(UpdateDutyRateCommand cmd, CancellationToken ct)
    {
        var rate = await db.DutyRates.FirstOrDefaultAsync(r => r.Id == cmd.Id && !r.IsDeleted, ct);
        if (rate is null) return Result.Failure<DutyRateDto>(Error.NotFoundById("DutyRate", cmd.Id));

        var i = cmd.Rate;
        var digits = HsDutyRate.Digits(i.HsCode);
        if (await db.DutyRates.AnyAsync(r => !r.IsDeleted && r.Id != cmd.Id && r.HsDigits == digits, ct))
            return Result.Failure<DutyRateDto>(Error.Custom("DutyRate.Duplicate", $"A rate for {i.HsCode.Trim()} already exists."));

        rate.Update(i.HsCode, i.Description, i.DutyPercent, i.Notes);
        await db.SaveChangesAsync(ct);
        return Result.Success(DutyMapping.ToDto(rate));
    }
}

internal sealed class DeleteDutyRateHandler(TradeDbContext db) : ICommandHandler<DeleteDutyRateCommand>
{
    public async Task<Result> Handle(DeleteDutyRateCommand cmd, CancellationToken ct)
    {
        var rate = await db.DutyRates.FirstOrDefaultAsync(r => r.Id == cmd.Id && !r.IsDeleted, ct);
        if (rate is null) return Result.Failure(Error.NotFoundById("DutyRate", cmd.Id));
        rate.Delete();
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

internal sealed class GetDutyEstimateHandler(TradeDbContext db) : IQueryHandler<GetDutyEstimateQuery, DutyEstimateDto>
{
    public async Task<Result<DutyEstimateDto>> Handle(GetDutyEstimateQuery q, CancellationToken ct)
    {
        var s = await ShipmentSupport.LoadAsync(db, q.ShipmentId, ct, tracking: false);
        if (s is null) return Result.Failure<DutyEstimateDto>(Error.NotFoundById("Shipment", q.ShipmentId));

        var rates = await db.DutyRates.AsNoTracking().Where(r => !r.IsDeleted).ToListAsync(ct);

        // Customs value per line, in the workspace currency. On a CIF basis the freight and insurance
        // already entered are shared across the lines by their goods value.
        var items = s.Items.OrderBy(i => i.Position).ToList();
        var goods = items.Select(i => Math.Round(i.LineValue * s.ExchangeRate, 2)).ToArray();
        var carriageTotal = q.IncludeFreightInsurance
            ? s.Costs.Where(c => c.Type is CostType.Freight or CostType.Insurance).Sum(c => c.Amount) : 0m;
        var shares = carriageTotal > 0 && items.Count > 0
            ? LandedCost.Spread(carriageTotal, goods.Sum() > 0 ? goods : items.Select(_ => 1m).ToArray())
            : new decimal[items.Count];

        var lines = items.Select((i, n) =>
        {
            var value = goods[n] + shares[n];
            var rate  = HsDutyRate.Match(rates, i.HsCode);
            return new DutyLineDto(i.Id, i.Description, i.HsCode, value, rate?.HsCode, rate?.DutyPercent,
                rate is null ? 0m : Math.Round(value * rate.DutyPercent / 100m, 2));
        }).ToList();

        return Result.Success(new DutyEstimateDto(lines, lines.Sum(l => l.Duty), lines.Sum(l => l.CustomsValue),
            lines.Count(l => l.Rate is null), q.IncludeFreightInsurance));
    }
}
