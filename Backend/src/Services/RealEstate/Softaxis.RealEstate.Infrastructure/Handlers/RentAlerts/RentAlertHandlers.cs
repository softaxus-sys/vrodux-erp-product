using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.RealEstate.Application.Contracts.Commands;
using Softaxis.RealEstate.Application.RentAlerts.Commands;
using Softaxis.RealEstate.Application.RentAlerts.Dtos;
using Softaxis.RealEstate.Application.RentAlerts.Queries;
using Softaxis.RealEstate.Domain.Entities;
using Softaxis.RealEstate.Infrastructure.Persistence;
using Softaxis.RealEstate.Infrastructure.Services;

namespace Softaxis.RealEstate.Infrastructure.Handlers.RentAlerts;

internal static class RentAlertMappings
{
    public static RentAlertSettingsDto ToDto(RentAlertSettings s, bool emailConfigured) => new(
        s.Enabled, s.DueReminderDaysBefore, s.OverdueRepeatDays, s.OverdueMaxReminders,
        s.ExpiryReminderDaysBefore, s.CcEmails, s.CcAllRealEstateUsers, s.TimeZoneId, emailConfigured);
}

internal sealed class GetRentAlertSettingsHandler(RealEstateDbContext db, IConfiguration configuration)
    : IQueryHandler<GetRentAlertSettingsQuery, RentAlertSettingsDto>
{
    public async Task<Result<RentAlertSettingsDto>> Handle(GetRentAlertSettingsQuery query, CancellationToken ct)
    {
        var settings = await RentAlertSettingsStore.GetOrCreateAsync(db, ct);
        return Result.Success(RentAlertMappings.ToDto(settings, SmtpRealEstateEmailService.IsConfigured(configuration)));
    }
}

internal sealed class UpdateRentAlertSettingsHandler(RealEstateDbContext db, IConfiguration configuration)
    : ICommandHandler<UpdateRentAlertSettingsCommand, RentAlertSettingsDto>
{
    public async Task<Result<RentAlertSettingsDto>> Handle(UpdateRentAlertSettingsCommand cmd, CancellationToken ct)
    {
        // Rejected here rather than silently accepted: a zone the server cannot resolve would fall
        // back to UTC at send time, quietly shifting every due-date decision by the offset.
        if (!string.IsNullOrWhiteSpace(cmd.TimeZoneId))
        {
            try { TimeZoneInfo.FindSystemTimeZoneById(cmd.TimeZoneId); }
            catch
            {
                return Result.Failure<RentAlertSettingsDto>(Error.Custom("RentAlert.InvalidTimeZone",
                    $"\"{cmd.TimeZoneId}\" is not a time zone this server recognises."));
            }
        }

        var settings = await RentAlertSettingsStore.GetOrCreateAsync(db, ct);
        settings.Update(cmd.Enabled, cmd.DueReminderDaysBefore, cmd.OverdueRepeatDays,
            cmd.OverdueMaxReminders, cmd.ExpiryReminderDaysBefore, cmd.CcEmails,
            cmd.CcAllRealEstateUsers, cmd.TimeZoneId);

        await db.SaveChangesAsync(ct);

        return Result.Success(RentAlertMappings.ToDto(settings, SmtpRealEstateEmailService.IsConfigured(configuration)));
    }
}

internal sealed class GetRentAlertLogsHandler(RealEstateDbContext db)
    : IQueryHandler<GetRentAlertLogsQuery, IReadOnlyList<RentAlertLogDto>>
{
    public async Task<Result<IReadOnlyList<RentAlertLogDto>>> Handle(GetRentAlertLogsQuery query, CancellationToken ct)
    {
        var q = db.RentAlertLogs.AsNoTracking().AsQueryable();
        if (query.ContractId is { } cid) q = q.Where(l => l.ContractId == cid);

        var rows = await q.OrderByDescending(l => l.CreatedAt)
            .Take(Math.Clamp(query.Limit, 1, 500))
            .Select(l => new RentAlertLogDto(l.Id, l.ContractId, l.InstallmentId, l.Kind, l.OffsetKey,
                l.ToEmail, l.CcEmails, l.Sent, l.FailureReason, l.CreatedAt))
            .ToListAsync(ct);

        return Result.Success<IReadOnlyList<RentAlertLogDto>>(rows);
    }
}

internal sealed class GetExpiringContractsHandler(RealEstateDbContext db)
    : IQueryHandler<GetExpiringContractsQuery, IReadOnlyList<ExpiringContractDto>>
{
    public async Task<Result<IReadOnlyList<ExpiringContractDto>>> Handle(
        GetExpiringContractsQuery query, CancellationToken ct)
    {
        var today   = (await RentAlertSettingsStore.GetOrCreateAsync(db, ct)).Today();
        var horizon = DateTime.Parse(today).AddDays(Math.Max(0, query.WithinDays)).ToString("yyyy-MM-dd");

        var rows = await (
            from c in db.LeaseContracts.AsNoTracking()
            join t in db.Tenants.AsNoTracking() on c.TenantId equals t.Id
            where !c.IsDeleted && !t.IsDeleted
                  && c.Status == "active"
                  && string.Compare(c.EndDate, horizon) <= 0
            select new
            {
                c.Id, c.ContractNumber, c.TenantId, TenantName = t.Name, TenantEmail = t.Email,
                c.PropertyName, c.UnitNumber, c.EndDate, c.AnnualRent, c.TotalPaid, c.Status,
            }).ToListAsync(ct);

        var items = rows
            .Select(r => new ExpiringContractDto(
                r.Id, r.ContractNumber, r.TenantId, r.TenantName, r.TenantEmail,
                r.PropertyName, r.UnitNumber, r.EndDate,
                DaysBetween(today, r.EndDate) ?? 0,
                r.AnnualRent, r.AnnualRent - r.TotalPaid, r.Status))
            // Already-expired leases first, then soonest — the order they need attention in.
            .OrderBy(x => x.DaysToExpiry)
            .ToList();

        return Result.Success<IReadOnlyList<ExpiringContractDto>>(items);
    }

    private static int? DaysBetween(string from, string to) =>
        DateTime.TryParse(from, out var f) && DateTime.TryParse(to, out var t)
            ? (int)(t.Date - f.Date).TotalDays
            : null;
}

internal sealed class RunRentAlertSweepHandler(IRentAlertSender sender)
    : ICommandHandler<RunRentAlertSweepCommand, RentAlertRunResultDto>
{
    public async Task<Result<RentAlertRunResultDto>> Handle(RunRentAlertSweepCommand cmd, CancellationToken ct) =>
        Result.Success(await sender.RunForCurrentTenantAsync(cmd.DryRun, ct));
}

internal sealed class SendRentReminderHandler(IRentAlertSender sender)
    : ICommandHandler<SendRentReminderCommand, string>
{
    public async Task<Result<string>> Handle(SendRentReminderCommand cmd, CancellationToken ct)
    {
        var result = await sender.SendOneAsync(cmd.ContractId, cmd.InstallmentId, ct);

        // Reported as a failure rather than a cheerful 200: "sent" when nothing left the building
        // is the single most misleading thing this feature could tell an operator.
        if (result.Failed > 0)
            return Result.Failure<string>(Error.Custom("RentAlert.SendFailed",
                result.Messages.FirstOrDefault() ?? "The notice could not be delivered."));

        return Result.Success(result.Messages.FirstOrDefault() ?? "Sent.");
    }
}
