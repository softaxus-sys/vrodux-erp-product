using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Library.API.Authorization;
using Softaxis.Library.API.Controllers.Common;
using Softaxis.Library.Application.Reminders;

namespace Softaxis.Library.API.Controllers;

/// <summary>
/// Member email notices. Part of library setup: turning them on, or sending them by hand, emails
/// every member with something due — a manager's decision, not the desk's.
/// </summary>
[Route("api/library/reminders")][Authorize]
public sealed class RemindersController(ISender sender) : LibraryControllerBase
{
    [HttpGet("settings")]
    [RequirePermission("library.setup.view", "library.setup.edit")]
    public async Task<IActionResult> GetSettings(CancellationToken ct) =>
        OkOrError(await sender.Send(new GetReminderSettingsQuery(), ct));

    [HttpPut("settings")]
    [RequirePermission("library.setup.edit")]
    public async Task<IActionResult> UpdateSettings([FromBody] SettingsRequest req, CancellationToken ct) =>
        OkOrError(await sender.Send(new UpdateReminderSettingsCommand(
            req.Enabled, req.DueSoonDays, req.OverdueEveryDays, req.OverdueMaxReminders, req.NotifyReady,
            req.LibraryName, req.TimeZoneId), ct));

    /// <summary>Preview (<c>dryRun</c>) or send what is owed right now.</summary>
    [HttpPost("run")]
    [RequirePermission("library.setup.edit")]
    public async Task<IActionResult> Run([FromBody] RunRequest req, CancellationToken ct) =>
        OkOrError(await sender.Send(new RunRemindersCommand(req.DryRun, req.Today), ct));

    [HttpGet("log")]
    [RequirePermission("library.setup.view", "library.setup.edit")]
    public async Task<IActionResult> GetLog(CancellationToken ct) =>
        OkOrError(await sender.Send(new GetReminderLogQuery(), ct));

    public sealed record SettingsRequest(
        bool Enabled, int DueSoonDays, int OverdueEveryDays, int OverdueMaxReminders, bool NotifyReady,
        string? LibraryName, string TimeZoneId);

    public sealed record RunRequest(bool DryRun = true, string? Today = null);
}
