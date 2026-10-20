using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.RealEstate.Application.Abstractions;
using Softaxis.RealEstate.Application.Contracts.Commands;
using Softaxis.RealEstate.Application.Contracts.Dtos;
using Softaxis.RealEstate.Application.Contracts.Queries;
using Softaxis.RealEstate.Domain.Entities;
using Softaxis.RealEstate.Infrastructure.Handlers.RentAlerts;
using Softaxis.RealEstate.Infrastructure.Handlers.Units;
using Softaxis.RealEstate.Infrastructure.Persistence;

namespace Softaxis.RealEstate.Infrastructure.Handlers.Contracts;

// As everywhere in this folder: every query filters !IsDeleted by hand, because the tenant filter
// replaces the entity's own soft-delete filter.

/// <summary>The parts of renewing and ending a lease that more than one handler needs.</summary>
internal static class LeaseLifecycle
{
    public static decimal RentPaid(LeaseContract c)
    {
        var live = c.Installments.Where(i => !i.IsDeleted).ToList();
        return live.Count == 0 ? c.TotalPaid : live.Sum(i => i.AmountPaid);
    }

    public static decimal Outstanding(LeaseContract c) =>
        c.Installments.Where(i => !i.IsDeleted && !i.IsSettled).Sum(i => i.Balance);

    public static LeaseTerminationDto ToDto(LeaseTermination t) => new(
        t.Id, t.ContractId, t.Status, t.TerminationDate, t.NoticeDate, t.Reason, t.ReasonNotes,
        t.RentOwed, t.RentPaid,
        Math.Max(0, t.RentOwed - t.RentPaid), Math.Max(0, t.RentPaid - t.RentOwed),
        t.DepositHeld, t.PenaltyAmount, t.DeductionsAmount, t.DeductionNotes, t.NetSettlement,
        t.SettledOn, t.SettlementMethod, t.SettlementReference, t.SettlementNotes,
        t.RecordedByName, t.CreatedAt);

    /// <summary>
    /// The termination date has arrived: the lease ends, its unit is freed and the final account
    /// is fixed. Figures are recomputed here rather than trusted from when notice was given,
    /// because rent may have been paid in between.
    /// </summary>
    public static async Task TakeEffectAsync(
        RealEstateDbContext db, LeaseContract lease, LeaseTermination termination, CancellationToken ct)
    {
        lease.CancelInstallmentsAfter(termination.TerminationDate,
            "Lease terminated on " + termination.TerminationDate + ".");
        lease.RecalculateTotals();

        termination.SetFigures(
            lease.RentOwedThrough(termination.TerminationDate), RentPaid(lease), lease.SecurityDeposit);
        termination.TakeEffect();
        lease.Terminate();

        var unit = await db.PropertyUnits.FirstOrDefaultAsync(u => u.Id == lease.UnitId && !u.IsDeleted, ct);
        // Only if this lease's tenant is still the one recorded on the unit — never evict someone else.
        if (unit is not null && (unit.CurrentTenantId is null || unit.CurrentTenantId == lease.TenantId))
            unit.Vacate();

        await db.SaveChangesAsync(ct);

        // Both read committed rows back, so they run after the save above.
        await PropertyCounts.RefreshAsync(db, lease.PropertyId, ct);
        await RefreshTenantStatsAsync(db, lease.TenantId, ct);
        await db.SaveChangesAsync(ct);
    }

    public static async Task RefreshTenantStatsAsync(RealEstateDbContext db, Guid tenantId, CancellationToken ct)
    {
        var tenant = await db.Tenants.FirstOrDefaultAsync(t => t.Id == tenantId && !t.IsDeleted, ct);
        if (tenant is null) return;

        var leases = await db.LeaseContracts.AsNoTracking()
            .Where(c => !c.IsDeleted && c.TenantId == tenantId)
            .Select(c => new { c.Status, c.TotalPaid })
            .ToListAsync(ct);

        tenant.UpdateStats(leases.Count(l => l.Status == "active"), leases.Sum(l => l.TotalPaid));
    }

    /// <summary>
    /// Ends every lease in the current workspace whose notice period has run out. Called by the
    /// daily sweep; returns how many leases ended.
    /// </summary>
    public static async Task<int> TakeEffectWhereDueAsync(RealEstateDbContext db, string today, CancellationToken ct)
    {
        var due = await db.LeaseTerminations
            .Where(t => t.Status == LeaseTermination.Scheduled && string.Compare(t.TerminationDate, today) <= 0)
            .ToListAsync(ct);

        var ended = 0;
        foreach (var termination in due)
        {
            var lease = await db.LeaseContracts.Include(c => c.Installments)
                .FirstOrDefaultAsync(c => c.Id == termination.ContractId && !c.IsDeleted, ct);

            // The lease was deleted or already ended some other way: the notice has nothing to act on.
            if (lease is null || lease.Status != "active")
            {
                db.LeaseTerminations.Remove(termination);
                await db.SaveChangesAsync(ct);
                continue;
            }

            await TakeEffectAsync(db, lease, termination, ct);
            ended++;
        }

        return ended;
    }
}

// ── Renewal ──────────────────────────────────────────────────────────────────

internal sealed class RenewContractHandler(RealEstateDbContext db)
    : ICommandHandler<RenewContractCommand, RenewedContractDto>
{
    public async Task<Result<RenewedContractDto>> Handle(RenewContractCommand cmd, CancellationToken ct)
    {
        var current = await db.LeaseContracts.Include(x => x.Installments)
            .FirstOrDefaultAsync(x => x.Id == cmd.Id && !x.IsDeleted, ct);
        if (current is null) return Result.Failure<RenewedContractDto>(Error.NotFoundById("Contract", cmd.Id));

        if (current.Status is not ("active" or "expired"))
            return Fail(current.Status == "renewed"
                ? "This lease has already been renewed. Open the latest lease in the chain to renew again."
                : "A terminated lease cannot be renewed. Create a new lease instead.");

        if (await db.LeaseTerminations.AsNoTracking().AnyAsync(t => t.ContractId == current.Id, ct))
            return Fail("Notice to end this lease is on record. Withdraw the notice before renewing.");

        // The two terms must not overlap, or the same days would be charged twice.
        if (string.CompareOrdinal(cmd.StartDate, current.EndDate) <= 0)
            return Fail("The renewal must start after the current lease ends (" + current.EndDate + ").");

        var unit = await db.PropertyUnits.FirstOrDefaultAsync(u => u.Id == current.UnitId && !u.IsDeleted, ct);
        if (unit is null) return Result.Failure<RenewedContractDto>(Error.NotFoundById("Unit", current.UnitId));

        var tenant = await db.Tenants.AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == current.TenantId && !t.IsDeleted, ct);
        if (tenant is null) return Result.Failure<RenewedContractDto>(Error.NotFoundById("Tenant", current.TenantId));

        // An expired lease may have been followed by a lease to someone else in the meantime.
        var letToAnother = await db.LeaseContracts.AsNoTracking()
            .AnyAsync(c => !c.IsDeleted && c.UnitId == current.UnitId && c.Status == "active" && c.Id != current.Id, ct);
        if (letToAnother)
            return Fail("Unit " + unit.UnitNumber + " already has another active lease.");

        var renewal = current.CreateRenewal(cmd.StartDate, cmd.EndDate, cmd.AnnualRent,
            cmd.SecurityDeposit, cmd.PaymentFrequency, cmd.EjariNumber, cmd.Notes);
        renewal.GenerateSchedule();

        var advanceApplied = 0m;
        if (cmd.AdvanceRentAmount > 0)
        {
            if (cmd.AdvanceRentAmount > renewal.ScheduledTotal + 0.01m)
                return Fail("The advance is more than the whole renewal is worth ("
                    + renewal.ScheduledTotal.ToString("N2") + "). Check the amount.");

            advanceApplied = renewal.ApplyAdvancePayment(
                cmd.AdvanceRentAmount, cmd.AdvancePaidDate ?? cmd.StartDate, cmd.AdvanceMethod, cmd.AdvanceReference);
        }

        var previousRent = current.AnnualRent;
        var outstanding  = LeaseLifecycle.Outstanding(current);

        db.LeaseContracts.Add(renewal);
        current.MarkRenewed(renewal.Id);
        unit.Occupy(current.TenantId, tenant.Name);     // an expired lease may have left it vacant

        await db.SaveChangesAsync(ct);

        await PropertyCounts.RefreshAsync(db, current.PropertyId, ct);
        await LeaseLifecycle.RefreshTenantStatsAsync(db, current.TenantId, ct);
        await db.SaveChangesAsync(ct);

        var nextDue = renewal.Installments
            .Where(i => !i.IsDeleted && !i.IsSettled)
            .OrderBy(i => i.InstallmentNumber)
            .FirstOrDefault();

        return Result.Success(new RenewedContractDto(
            renewal.Id, renewal.ContractNumber, renewal.RenewalNumber, renewal.Installments.Count,
            previousRent,
            previousRent > 0 ? Math.Round((cmd.AnnualRent - previousRent) / previousRent * 100m, 2) : 0m,
            outstanding, advanceApplied, nextDue?.DueDate));
    }

    private static Result<RenewedContractDto> Fail(string message) =>
        Result.Failure<RenewedContractDto>(Error.Custom("Contract.Conflict", message));
}

// ── Termination ──────────────────────────────────────────────────────────────

internal sealed class GetTerminationPreviewHandler(RealEstateDbContext db)
    : IQueryHandler<GetTerminationPreviewQuery, TerminationStatementDto>
{
    public async Task<Result<TerminationStatementDto>> Handle(GetTerminationPreviewQuery query, CancellationToken ct)
    {
        var c = await db.LeaseContracts.AsNoTracking().Include(x => x.Installments)
            .FirstOrDefaultAsync(x => x.Id == query.Id && !x.IsDeleted, ct);
        if (c is null) return Result.Failure<TerminationStatementDto>(Error.NotFoundById("Contract", query.Id));

        if (!DateTime.TryParseExact(query.TerminationDate, "yyyy-MM-dd", null,
                System.Globalization.DateTimeStyles.None, out _))
            return Result.Failure<TerminationStatementDto>(Error.Custom("Contract.Conflict",
                "Termination date must be yyyy-MM-dd."));

        var today = (await RentAlertSettingsStore.GetOrCreateAsync(db, ct)).Today();

        var owed = c.RentOwedThrough(query.TerminationDate);
        var paid = LeaseLifecycle.RentPaid(c);

        var cancellable = c.Installments
            .Where(i => !i.IsDeleted && !i.IsSettled && i.AmountPaid == 0
                     && string.CompareOrdinal(i.DueDate, query.TerminationDate) > 0)
            .ToList();

        var penalty    = Math.Max(0, query.PenaltyAmount);
        var deductions = Math.Max(0, query.DeductionsAmount);

        return Result.Success(new TerminationStatementDto(
            query.TerminationDate, owed, paid,
            Math.Max(0, owed - paid), Math.Max(0, paid - owed),
            c.SecurityDeposit, penalty, deductions,
            LeaseTermination.Net(c.SecurityDeposit, paid, owed, penalty, deductions),
            cancellable.Count, cancellable.Sum(i => i.Amount),
            string.CompareOrdinal(query.TerminationDate, today) <= 0));
    }
}

internal sealed class TerminateContractHandler(RealEstateDbContext db, ICurrentUser user)
    : ICommandHandler<TerminateContractCommand, LeaseTerminationDto>
{
    public async Task<Result<LeaseTerminationDto>> Handle(TerminateContractCommand cmd, CancellationToken ct)
    {
        var c = await db.LeaseContracts.Include(x => x.Installments)
            .FirstOrDefaultAsync(x => x.Id == cmd.Id && !x.IsDeleted, ct);
        if (c is null) return Result.Failure<LeaseTerminationDto>(Error.NotFoundById("Contract", cmd.Id));

        if (c.Status != "active")
            return Fail("Only an active lease can be terminated. This one is " + c.Status + ".");

        if (await db.LeaseTerminations.AsNoTracking().AnyAsync(t => t.ContractId == c.Id, ct))
            return Fail("Notice to end this lease is already on record. Withdraw it first to change the date.");

        if (string.CompareOrdinal(cmd.TerminationDate, c.StartDate) < 0)
            return Fail("The termination date is before the lease started (" + c.StartDate + ").");

        if (string.CompareOrdinal(cmd.TerminationDate, c.EndDate) > 0)
            return Fail("The termination date is after the lease ends (" + c.EndDate
                + "). Let the lease expire, or renew it.");

        if (!LeaseTermination.Reasons.Contains(cmd.Reason))
            return Fail("Choose a reason for ending the lease.");

        var today = (await RentAlertSettingsStore.GetOrCreateAsync(db, ct)).Today();

        var termination = new LeaseTermination(c.Id, cmd.TerminationDate, cmd.NoticeDate,
            cmd.Reason, cmd.ReasonNotes, cmd.PenaltyAmount, cmd.DeductionsAmount, cmd.DeductionNotes,
            user.Username ?? user.Email);

        db.LeaseTerminations.Add(termination);

        if (string.CompareOrdinal(cmd.TerminationDate, today) <= 0)
        {
            await LeaseLifecycle.TakeEffectAsync(db, c, termination, ct);
        }
        else
        {
            // Notice only: the tenant stays, and rent up to the last day is still chased. Payments
            // after the last day stop being owed now, so no reminder goes out for them.
            c.CancelInstallmentsAfter(cmd.TerminationDate, "Notice given: lease ends on " + cmd.TerminationDate + ".");
            termination.SetFigures(c.RentOwedThrough(cmd.TerminationDate), LeaseLifecycle.RentPaid(c), c.SecurityDeposit);
            await db.SaveChangesAsync(ct);
        }

        return Result.Success(LeaseLifecycle.ToDto(termination));
    }

    private static Result<LeaseTerminationDto> Fail(string message) =>
        Result.Failure<LeaseTerminationDto>(Error.Custom("Contract.Conflict", message));
}

internal sealed class WithdrawTerminationHandler(RealEstateDbContext db)
    : ICommandHandler<WithdrawTerminationCommand>
{
    public async Task<Result> Handle(WithdrawTerminationCommand cmd, CancellationToken ct)
    {
        var c = await db.LeaseContracts.Include(x => x.Installments)
            .FirstOrDefaultAsync(x => x.Id == cmd.Id && !x.IsDeleted, ct);
        if (c is null) return Result.Failure(Error.NotFoundById("Contract", cmd.Id));

        var termination = await db.LeaseTerminations.FirstOrDefaultAsync(t => t.ContractId == c.Id, ct);
        if (termination is null)
            return Result.Failure(Error.Custom("Termination.NotFound", "This lease has no notice on record."));

        if (termination.Status != LeaseTermination.Scheduled)
            return Result.Failure(Error.Custom("Contract.Conflict",
                "This lease has already ended, so the termination cannot be withdrawn. Create a new lease if the tenant is staying."));

        c.ReinstateCancelledInstallments();
        db.LeaseTerminations.Remove(termination);

        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

internal sealed class SettleTerminationHandler(RealEstateDbContext db)
    : ICommandHandler<SettleTerminationCommand, LeaseTerminationDto>
{
    public async Task<Result<LeaseTerminationDto>> Handle(SettleTerminationCommand cmd, CancellationToken ct)
    {
        var exists = await db.LeaseContracts.AsNoTracking().AnyAsync(x => x.Id == cmd.Id && !x.IsDeleted, ct);
        if (!exists) return Result.Failure<LeaseTerminationDto>(Error.NotFoundById("Contract", cmd.Id));

        var termination = await db.LeaseTerminations.FirstOrDefaultAsync(t => t.ContractId == cmd.Id, ct);
        if (termination is null)
            return Result.Failure<LeaseTerminationDto>(Error.Custom("Termination.NotFound",
                "This lease has no termination on record."));

        if (termination.Status == LeaseTermination.Scheduled)
            return Fail("The lease has not ended yet. The final account can be settled from "
                + termination.TerminationDate + ".");

        if (termination.Status == LeaseTermination.Settled)
            return Fail("The final account for this lease is already settled.");

        termination.Settle(cmd.SettledOn, cmd.Method, cmd.Reference, cmd.Notes);
        await db.SaveChangesAsync(ct);

        return Result.Success(LeaseLifecycle.ToDto(termination));
    }

    private static Result<LeaseTerminationDto> Fail(string message) =>
        Result.Failure<LeaseTerminationDto>(Error.Custom("Contract.Conflict", message));
}
