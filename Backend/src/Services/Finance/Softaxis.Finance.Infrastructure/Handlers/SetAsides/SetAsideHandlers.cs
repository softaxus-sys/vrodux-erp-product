using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Finance.Application.SetAsides;
using Softaxis.Finance.Domain.Entities;
using Softaxis.Finance.Infrastructure.Handlers.GeneralLedger;
using Softaxis.Finance.Infrastructure.Persistence;

namespace Softaxis.Finance.Infrastructure.Handlers.SetAsides;

internal sealed class GetSetAsideRulesHandler(FinanceDbContext db)
    : IQueryHandler<GetSetAsideRulesQuery, IReadOnlyList<SetAsideRuleDto>>
{
    public async Task<Result<IReadOnlyList<SetAsideRuleDto>>> Handle(GetSetAsideRulesQuery q, CancellationToken ct)
    {
        // !IsDeleted by hand: the tenant filter replaces any entity-level soft-delete filter.
        var rows = await db.SetAsideRules.AsNoTracking()
            .Where(r => !r.IsDeleted).OrderBy(r => r.CreatedAt).ToListAsync(ct);
        return Result.Success<IReadOnlyList<SetAsideRuleDto>>(
            rows.Select(r => new SetAsideRuleDto(r.Id, r.Name, r.Kind, r.Value, r.AutoApply, r.IsActive)).ToList());
    }
}

internal sealed class SaveSetAsideRuleHandler(FinanceDbContext db)
    : ICommandHandler<SaveSetAsideRuleCommand, SetAsideRuleDto>
{
    public async Task<Result<SetAsideRuleDto>> Handle(SaveSetAsideRuleCommand cmd, CancellationToken ct)
    {
        SetAsideRule? rule;
        if (cmd.Id is { } id)
        {
            rule = await db.SetAsideRules.FirstOrDefaultAsync(r => r.Id == id && !r.IsDeleted, ct);
            if (rule is null)
                return Result.Failure<SetAsideRuleDto>(Error.NotFoundById("SetAsideRule", id));
            rule.Update(cmd.Name, cmd.Kind, cmd.Value, cmd.AutoApply, cmd.IsActive);
        }
        else
        {
            rule = new SetAsideRule(cmd.Name, cmd.Kind, cmd.Value, cmd.AutoApply);
            if (!cmd.IsActive) rule.Update(cmd.Name, cmd.Kind, cmd.Value, cmd.AutoApply, false);
            db.SetAsideRules.Add(rule);
        }

        await db.SaveChangesAsync(ct);
        return Result.Success(new SetAsideRuleDto(rule.Id, rule.Name, rule.Kind, rule.Value, rule.AutoApply, rule.IsActive));
    }
}

internal sealed class DeleteSetAsideRuleHandler(FinanceDbContext db) : ICommandHandler<DeleteSetAsideRuleCommand>
{
    public async Task<Result> Handle(DeleteSetAsideRuleCommand cmd, CancellationToken ct)
    {
        var rule = await db.SetAsideRules.FirstOrDefaultAsync(r => r.Id == cmd.Id && !r.IsDeleted, ct);
        if (rule is null)
            return Result.Failure(Error.NotFoundById("SetAsideRule", cmd.Id));

        // Only stops it applying to FUTURE invoices. Invoices already carry their own copy, and
        // anything already owed stays owed.
        rule.Delete();
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

internal sealed class GetSetAsideDashboardHandler(FinanceDbContext db)
    : IQueryHandler<GetSetAsideDashboardQuery, SetAsideDashboardDto>
{
    public async Task<Result<SetAsideDashboardDto>> Handle(GetSetAsideDashboardQuery q, CancellationToken ct)
    {
        var from = string.IsNullOrWhiteSpace(q.From) ? null : q.From;
        var to   = string.IsNullOrWhiteSpace(q.To)   ? null : q.To;

        var hasRules = await db.SetAsideRules.AsNoTracking().AnyAsync(r => !r.IsDeleted, ct);

        var all = await db.SetAsideEntries.AsNoTracking().Where(e => !e.IsDeleted).ToListAsync(ct);
        var payouts = await db.SetAsidePayouts.AsNoTracking().OrderByDescending(p => p.PaidOn).ThenByDescending(p => p.CreatedAt).ToListAsync(ct);
        var payoutById = payouts.ToDictionary(p => p.Id);

        bool InRange(string date) =>
            (from is null || string.CompareOrdinal(date, from) >= 0) && (to is null || string.CompareOrdinal(date, to) <= 0);

        var inRange = all.Where(e => InRange(e.AccruedOn)).ToList();
        var owedAll = all.Where(e => !e.IsPaid).ToList();

        // Income covered by the payments in range: one figure per payment event, not per rule row.
        var income  = inRange.GroupBy(e => e.EventId).Sum(g => g.First().BaseLedgerAmount);
        var accrued = inRange.Sum(e => e.LedgerAmount);
        var paid    = payouts.Where(p => InRange(p.PaidOn)).Sum(p => p.Total);

        var byRule = all.GroupBy(e => e.Name).Select(g => new SetAsideRuleTotalDto(
                g.Key,
                g.Where(e => InRange(e.AccruedOn)).Sum(e => e.LedgerAmount),
                g.Where(e => InRange(e.AccruedOn) && e.IsPaid).Sum(e => e.LedgerAmount),
                g.Where(e => !e.IsPaid).Sum(e => e.LedgerAmount)))
            .OrderByDescending(r => r.Owed).ThenBy(r => r.Name).ToList();

        var months = inRange.GroupBy(e => e.AccruedOn[..7]).ToDictionary(g => g.Key, g => g.Sum(e => e.LedgerAmount));
        var paidMonths = payouts.Where(p => InRange(p.PaidOn)).GroupBy(p => p.PaidOn[..7]).ToDictionary(g => g.Key, g => g.Sum(p => p.Total));
        var byMonth = months.Keys.Union(paidMonths.Keys).OrderBy(m => m)
            .Select(m => new SetAsideMonthDto(m, months.GetValueOrDefault(m), paidMonths.GetValueOrDefault(m))).ToList();

        var counts = all.Where(e => e.PayoutId.HasValue).GroupBy(e => e.PayoutId!.Value).ToDictionary(g => g.Key, g => g.Count());

        return Result.Success(new SetAsideDashboardDto(
            hasRules || all.Count > 0,
            owedAll.Sum(e => e.LedgerAmount), accrued, paid, income,
            income > 0 ? Math.Round(accrued / income * 100m, 2) : 0m,
            byRule, byMonth,
            owedAll.OrderBy(e => e.AccruedOn).ThenBy(e => e.InvoiceNumber)
                .Select(e => new SetAsideOwedEntryDto(e.Id, e.InvoiceId, e.InvoiceNumber, e.Name, e.Amount, e.LedgerAmount, e.CurrencyCode, e.AccruedOn)).ToList(),
            payouts.Take(20).Select(p => new SetAsidePayoutDto(p.Id, p.PaidOn, p.Total, p.FromAccountNumber, p.Reference, p.Notes, counts.GetValueOrDefault(p.Id))).ToList()));
    }
}

internal sealed class PaySetAsidesHandler(FinanceDbContext db) : ICommandHandler<PaySetAsidesCommand, SetAsidePayoutDto>
{
    public async Task<Result<SetAsidePayoutDto>> Handle(PaySetAsidesCommand cmd, CancellationToken ct)
    {
        if (await GlPoster.IsPeriodClosedAsync(db, cmd.PaidOn, ct))
            return Result.Failure<SetAsidePayoutDto>(Error.Custom("FiscalPeriod.Locked",
                $"The fiscal period for {cmd.PaidOn} is closed for posting."));

        var account = await db.Accounts.AsNoTracking()
            .FirstOrDefaultAsync(a => a.AccountNumber == cmd.FromAccountNumber && !a.IsDeleted, ct);
        if (account is null)
            return Result.Failure<SetAsidePayoutDto>(Error.Custom("SetAside.NotFound",
                $"Account {cmd.FromAccountNumber} was not found."));

        var ids = cmd.EntryIds.Distinct().ToList();
        var entries = await db.SetAsideEntries.Where(e => ids.Contains(e.Id) && !e.IsDeleted).ToListAsync(ct);
        if (entries.Count != ids.Count)
            return Result.Failure<SetAsidePayoutDto>(Error.Custom("SetAside.NotFound", "Some of the chosen amounts no longer exist."));
        if (entries.Any(e => e.IsPaid))
            return Result.Failure<SetAsidePayoutDto>(Error.Custom("SetAside.Conflict", "Some of the chosen amounts are already paid."));

        var total = entries.Sum(e => e.LedgerAmount);
        if (total <= 0)
            return Result.Failure<SetAsidePayoutDto>(Error.Custom("SetAside.Conflict", "Nothing to pay."));

        var names = string.Join(", ", entries.Select(e => e.Name).Distinct());
        var journalId = await GlPoster.PostAsync(db, cmd.PaidOn, $"Set-aside paid out - {names}", cmd.Reference,
        [
            new(GlPoster.SetAsidePayable, total, 0, $"Paid out - {names}"),
            new(cmd.FromAccountNumber, 0, total, $"Paid out - {names}"),
        ], ct);

        var payout = new SetAsidePayout(cmd.PaidOn, cmd.FromAccountNumber, total, cmd.Reference, cmd.Notes, journalId);
        db.SetAsidePayouts.Add(payout);
        foreach (var e in entries) e.MarkPaid(payout.Id);

        await db.SaveChangesAsync(ct);
        return Result.Success(new SetAsidePayoutDto(payout.Id, payout.PaidOn, payout.Total,
            payout.FromAccountNumber, payout.Reference, payout.Notes, entries.Count));
    }
}

internal sealed class UndoSetAsidePayoutHandler(FinanceDbContext db) : ICommandHandler<UndoSetAsidePayoutCommand>
{
    public async Task<Result> Handle(UndoSetAsidePayoutCommand cmd, CancellationToken ct)
    {
        var payout = await db.SetAsidePayouts.FirstOrDefaultAsync(p => p.Id == cmd.PayoutId, ct);
        if (payout is null)
            return Result.Failure(Error.NotFoundById("SetAsidePayout", cmd.PayoutId));

        if (await GlPoster.IsPeriodClosedAsync(db, payout.PaidOn, ct))
            return Result.Failure(Error.Custom("FiscalPeriod.Locked", $"The fiscal period for {payout.PaidOn} is closed for posting."));

        var entries = await db.SetAsideEntries.Where(e => e.PayoutId == payout.Id).ToListAsync(ct);
        foreach (var e in entries) e.Unpay();

        await GlPoster.VoidAsync(db, payout.JournalEntryId, ct);
        db.SetAsidePayouts.Remove(payout);

        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
