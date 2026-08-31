using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.RealEstate.API.Authorization;
using Softaxis.RealEstate.API.Controllers.Common;
using Softaxis.RealEstate.Application.RentAlerts.Commands;
using Softaxis.RealEstate.Application.RentAlerts.Queries;

namespace Softaxis.RealEstate.API.Controllers;

[ApiController][Route("api/real-estate/rent-alerts")][Authorize]
public sealed class RentAlertsController(ISender sender) : RealEstateControllerBase
{
    public sealed record UpdateSettingsRequest(
        bool Enabled, string DueReminderDaysBefore, int OverdueRepeatDays, int OverdueMaxReminders,
        string ExpiryReminderDaysBefore, string? CcEmails, bool CcAllRealEstateUsers, string? TimeZoneId);

    public sealed record RunRequest(bool DryRun = false);

    [HttpGet("settings")]
    [RequirePermission("real-estate.alerts.view")]
    public async Task<IActionResult> GetSettings(CancellationToken ct) =>
        OkOrError(await sender.Send(new GetRentAlertSettingsQuery(), ct));

    [HttpPut("settings")]
    [RequirePermission("real-estate.alerts.edit")]
    public async Task<IActionResult> UpdateSettings([FromBody] UpdateSettingsRequest req, CancellationToken ct) =>
        OkOrError(await sender.Send(new UpdateRentAlertSettingsCommand(
            req.Enabled, req.DueReminderDaysBefore, req.OverdueRepeatDays, req.OverdueMaxReminders,
            req.ExpiryReminderDaysBefore, req.CcEmails, req.CcAllRealEstateUsers, req.TimeZoneId), ct));

    /// <summary>What has been sent, and what failed. The failure reasons are the only way to tell
    /// "nobody was due a reminder" apart from "the mail server rejected everything".</summary>
    [HttpGet("logs")]
    [RequirePermission("real-estate.alerts.view")]
    public async Task<IActionResult> GetLogs([FromQuery] Guid? contractId, [FromQuery] int limit = 100, CancellationToken ct = default) =>
        OkOrError(await sender.Send(new GetRentAlertLogsQuery(contractId, limit), ct));

    [HttpGet("expiring")]
    [RequirePermission("real-estate.contracts.view")]
    public async Task<IActionResult> GetExpiring([FromQuery] int withinDays = 90, CancellationToken ct = default) =>
        OkOrError(await sender.Send(new GetExpiringContractsQuery(withinDays), ct));

    /// <summary>Run this workspace's sweep now. Pass dryRun to see what WOULD be sent without
    /// sending it — the only safe way to check a new schedule against a live book of tenants.</summary>
    [HttpPost("run")]
    [RequirePermission("real-estate.alerts.edit")]
    public async Task<IActionResult> Run([FromBody] RunRequest req, CancellationToken ct) =>
        OkOrError(await sender.Send(new RunRentAlertSweepCommand(req.DryRun), ct));
}
