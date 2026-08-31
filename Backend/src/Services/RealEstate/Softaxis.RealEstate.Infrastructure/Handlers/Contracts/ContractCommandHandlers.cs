using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.RealEstate.Application.Contracts.Commands;
using Softaxis.RealEstate.Application.Contracts.Dtos;
using Softaxis.RealEstate.Domain.Entities;
using Softaxis.RealEstate.Infrastructure.Handlers.RentAlerts;
using Softaxis.RealEstate.Infrastructure.Persistence;

namespace Softaxis.RealEstate.Infrastructure.Handlers.Contracts;

// NOTE for every handler in this file: each query filters !IsDeleted BY HAND.
// TenantIsolation.ApplyTenantId REPLACES the entity HasQueryFilter(!IsDeleted), so relying on the
// configuration silently returns soft-deleted rows. Same gotcha documented for CRM, Visa, Restaurant.

internal sealed class CreateContractHandler(RealEstateDbContext db)
    : ICommandHandler<CreateContractCommand, CreatedContractDto>
{
    public async Task<Result<CreatedContractDto>> Handle(CreateContractCommand cmd, CancellationToken ct)
    {
        var unit = await db.PropertyUnits.FirstOrDefaultAsync(u => u.Id == cmd.UnitId && !u.IsDeleted, ct);
        if (unit is null) return Result.Failure<CreatedContractDto>(Error.NotFoundById("Unit", cmd.UnitId));

        var property = await db.Properties.AsNoTracking()
            .FirstOrDefaultAsync(p => p.Id == cmd.PropertyId && !p.IsDeleted, ct);
        if (property is null) return Result.Failure<CreatedContractDto>(Error.NotFoundById("Property", cmd.PropertyId));

        var tenant = await db.Tenants.AsNoTracking()
            .FirstOrDefaultAsync(t => t.Id == cmd.TenantId && !t.IsDeleted, ct);
        if (tenant is null) return Result.Failure<CreatedContractDto>(Error.NotFoundById("Tenant", cmd.TenantId));

        // A unit can only be let once at a time. Without this the same unit accrues two rent
        // schedules and a tenant gets reminders for a lease that is not theirs.
        var alreadyLet = await db.LeaseContracts.AsNoTracking()
            .AnyAsync(c => !c.IsDeleted && c.UnitId == cmd.UnitId && c.Status == "active", ct);
        if (alreadyLet)
            return Result.Failure<CreatedContractDto>(Error.Custom("Contract.Conflict",
                "Unit " + unit.UnitNumber + " already has an active lease. End it before creating a new one."));

        var contract = new LeaseContract(
            cmd.PropertyId, property.Name, cmd.UnitId, unit.UnitNumber,
            cmd.TenantId, tenant.Name, cmd.StartDate, cmd.EndDate,
            cmd.AnnualRent, 0, cmd.SecurityDeposit, cmd.EjariNumber, cmd.Notes, cmd.PaymentFrequency);

        contract.GenerateSchedule();

        // Advance rent taken at signing. Settling it now is what stops the reminder ladder firing
        // on day one for money the tenant has already handed over — the first installment is due
        // on the lease start date, so without this it is due (or overdue) immediately.
        var advanceApplied = 0m;
        if (cmd.AdvanceRentAmount > 0)
        {
            if (cmd.AdvanceRentAmount > contract.ScheduledTotal + 0.01m)
                return Result.Failure<CreatedContractDto>(Error.Custom("Contract.Conflict",
                    "The advance is more than the whole lease is worth ("
                    + contract.ScheduledTotal.ToString("N2") + "). Check the amount."));

            advanceApplied = contract.ApplyAdvancePayment(
                cmd.AdvanceRentAmount,
                cmd.AdvancePaidDate ?? cmd.StartDate,
                cmd.AdvanceMethod,
                cmd.AdvanceReference);
        }

        db.LeaseContracts.Add(contract);
        unit.Occupy(cmd.TenantId, tenant.Name);

        var activeLeases = await db.LeaseContracts.AsNoTracking()
            .CountAsync(c => !c.IsDeleted && c.TenantId == cmd.TenantId && c.Status == "active", ct);
        var tracked = await db.Tenants.FirstOrDefaultAsync(t => t.Id == cmd.TenantId, ct);
        tracked?.UpdateStats(activeLeases + 1, tracked.TotalPaid + advanceApplied);

        await db.SaveChangesAsync(ct);

        var settled = contract.Installments.Count(i => !i.IsDeleted && i.IsSettled);
        var nextDue = contract.Installments
            .Where(i => !i.IsDeleted && !i.IsSettled)
            .OrderBy(i => i.InstallmentNumber)
            .FirstOrDefault();

        return Result.Success(new CreatedContractDto(
            contract.Id, contract.ContractNumber, contract.Installments.Count,
            advanceApplied, settled, nextDue?.DueDate));
    }
}

internal sealed class UpdateContractHandler(RealEstateDbContext db) : ICommandHandler<UpdateContractCommand>
{
    public async Task<Result> Handle(UpdateContractCommand cmd, CancellationToken ct)
    {
        var c = await db.LeaseContracts.Include(x => x.Installments)
            .FirstOrDefaultAsync(x => x.Id == cmd.Id && !x.IsDeleted, ct);
        if (c is null) return Result.Failure(Error.NotFoundById("Contract", cmd.Id));

        c.Update(cmd.StartDate, cmd.EndDate, cmd.AnnualRent, cmd.SecurityDeposit,
            cmd.PaymentFrequency, cmd.EjariNumber, cmd.Notes);

        if (cmd.RegenerateSchedule && !c.GenerateSchedule(replaceExisting: true))
            return Result.Failure(Error.Custom("Contract.Conflict",
                "The schedule cannot be rebuilt because payments have already been recorded against it. Adjust the individual installments instead."));

        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

internal sealed class DeleteContractHandler(RealEstateDbContext db) : ICommandHandler<DeleteContractCommand>
{
    public async Task<Result> Handle(DeleteContractCommand cmd, CancellationToken ct)
    {
        var c = await db.LeaseContracts.Include(x => x.Installments)
            .FirstOrDefaultAsync(x => x.Id == cmd.Id && !x.IsDeleted, ct);
        if (c is null) return Result.Failure(Error.NotFoundById("Contract", cmd.Id));

        foreach (var i in c.Installments.Where(i => !i.IsDeleted)) i.Delete();
        c.Delete();

        // Free the unit, or it stays rented forever and can never be re-let.
        var unit = await db.PropertyUnits.FirstOrDefaultAsync(u => u.Id == c.UnitId && !u.IsDeleted, ct);
        unit?.Vacate();

        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

internal sealed class SetContractStatusHandler(RealEstateDbContext db) : ICommandHandler<SetContractStatusCommand>
{
    public async Task<Result> Handle(SetContractStatusCommand cmd, CancellationToken ct)
    {
        var c = await db.LeaseContracts.FirstOrDefaultAsync(x => x.Id == cmd.Id && !x.IsDeleted, ct);
        if (c is null) return Result.Failure(Error.NotFoundById("Contract", cmd.Id));

        switch (cmd.Status)
        {
            case "terminated": c.Terminate(); break;
            case "expired":    c.Expire();    break;
            case "renewed":    c.Renew();     break;
            default:
                return Result.Failure(Error.Custom("Contract.InvalidStatus",
                    "A lease cannot be moved back to active once it has ended. Create a renewal instead."));
        }

        if (cmd.Status is "terminated" or "expired")
        {
            var unit = await db.PropertyUnits.FirstOrDefaultAsync(u => u.Id == c.UnitId && !u.IsDeleted, ct);
            unit?.Vacate();
        }

        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

internal sealed class GenerateRentScheduleHandler(RealEstateDbContext db)
    : ICommandHandler<GenerateRentScheduleCommand, IReadOnlyList<RentInstallmentDto>>
{
    public async Task<Result<IReadOnlyList<RentInstallmentDto>>> Handle(
        GenerateRentScheduleCommand cmd, CancellationToken ct)
    {
        var c = await db.LeaseContracts.Include(x => x.Installments)
            .FirstOrDefaultAsync(x => x.Id == cmd.ContractId && !x.IsDeleted, ct);
        if (c is null)
            return Result.Failure<IReadOnlyList<RentInstallmentDto>>(Error.NotFoundById("Contract", cmd.ContractId));

        if (!c.GenerateSchedule(cmd.ReplaceExisting))
            return Result.Failure<IReadOnlyList<RentInstallmentDto>>(Error.Custom("Contract.Conflict",
                "This lease already has a schedule with payments recorded against it. Rebuilding would discard them."));

        await db.SaveChangesAsync(ct);

        var today = (await RentAlertSettingsStore.GetOrCreateAsync(db, ct)).Today();

        return Result.Success<IReadOnlyList<RentInstallmentDto>>(
            c.Installments.Where(i => !i.IsDeleted)
             .OrderBy(i => i.InstallmentNumber)
             .Select(i => ContractMappings.ToDto(i, today)).ToList());
    }
}

internal sealed class RecordInstallmentPaymentHandler(RealEstateDbContext db)
    : ICommandHandler<RecordInstallmentPaymentCommand, RentInstallmentDto>
{
    public async Task<Result<RentInstallmentDto>> Handle(RecordInstallmentPaymentCommand cmd, CancellationToken ct)
    {
        var c = await db.LeaseContracts.Include(x => x.Installments)
            .FirstOrDefaultAsync(x => x.Id == cmd.ContractId && !x.IsDeleted, ct);
        if (c is null) return Result.Failure<RentInstallmentDto>(Error.NotFoundById("Contract", cmd.ContractId));

        var inst = c.Installments.FirstOrDefault(i => i.Id == cmd.InstallmentId && !i.IsDeleted);
        if (inst is null) return Result.Failure<RentInstallmentDto>(Error.NotFoundById("Installment", cmd.InstallmentId));

        if (inst.Status == "waived")
            return Result.Failure<RentInstallmentDto>(Error.Custom("Installment.Conflict",
                "This installment was waived. Un-waive it before recording a payment."));

        // Overpayment is refused rather than silently absorbed: it is nearly always a payment
        // entered against the wrong installment, and absorbing it hides the real unpaid one.
        if (cmd.Amount > inst.Balance + 0.01m)
            return Result.Failure<RentInstallmentDto>(Error.Custom("Installment.Conflict",
                "That is more than the " + inst.Balance.ToString("N2") + " outstanding on installment "
                + inst.InstallmentNumber + "."));

        inst.RecordPayment(cmd.Amount, cmd.PaidDate, cmd.Method, cmd.Reference, cmd.Notes);
        c.RecalculateTotals();

        var tenant = await db.Tenants.FirstOrDefaultAsync(t => t.Id == c.TenantId && !t.IsDeleted, ct);
        if (tenant is not null)
        {
            var activeCount = await db.LeaseContracts.AsNoTracking()
                .CountAsync(x => !x.IsDeleted && x.TenantId == c.TenantId && x.Status == "active", ct);
            var paidAcrossLeases = await db.LeaseContracts.AsNoTracking()
                .Where(x => !x.IsDeleted && x.TenantId == c.TenantId && x.Id != c.Id)
                .SumAsync(x => (decimal?)x.TotalPaid, ct) ?? 0m;
            tenant.UpdateStats(activeCount, paidAcrossLeases + c.TotalPaid);
        }

        await db.SaveChangesAsync(ct);

        var today = (await RentAlertSettingsStore.GetOrCreateAsync(db, ct)).Today();
        return Result.Success(ContractMappings.ToDto(inst, today));
    }
}

internal sealed class WaiveInstallmentHandler(RealEstateDbContext db) : ICommandHandler<WaiveInstallmentCommand>
{
    public async Task<Result> Handle(WaiveInstallmentCommand cmd, CancellationToken ct)
    {
        var c = await db.LeaseContracts.Include(x => x.Installments)
            .FirstOrDefaultAsync(x => x.Id == cmd.ContractId && !x.IsDeleted, ct);
        if (c is null) return Result.Failure(Error.NotFoundById("Contract", cmd.ContractId));

        var inst = c.Installments.FirstOrDefault(i => i.Id == cmd.InstallmentId && !i.IsDeleted);
        if (inst is null) return Result.Failure(Error.NotFoundById("Installment", cmd.InstallmentId));

        inst.Waive(cmd.Reason);
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
