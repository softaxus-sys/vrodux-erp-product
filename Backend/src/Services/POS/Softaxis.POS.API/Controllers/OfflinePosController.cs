using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.POS.API.Authorization;
using Softaxis.POS.Application.OfflineSync;
using Softaxis.POS.Application.Settings;

namespace Softaxis.POS.API.Controllers;

/// <summary>Per-tenant POS settings (online / offline mode switch).</summary>
[Authorize]
[Route("api/pos-settings")]
public sealed class PosSettingsController(ISender sender) : BaseApiController(sender)
{
    [RequirePermission("pos.sessions.view")]
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct = default)
        => HandleResult(await Sender.Send(new GetPosSettingsQuery(), ct));

    /// <summary>What would block switching modes right now (open shifts, tills with unsynced records).</summary>
    [RequirePermission("pos.sessions.approve")]
    [HttpGet("switch-readiness")]
    public async Task<IActionResult> GetSwitchReadiness(CancellationToken ct = default)
        => HandleResult(await Sender.Send(new GetSwitchReadinessQuery(), ct));

    [RequirePermission("pos.sessions.approve")]
    [HttpPut]
    public async Task<IActionResult> Update([FromBody] UpdatePosSettingsCommand cmd, CancellationToken ct = default)
        => HandleResult(await Sender.Send(cmd, ct));
}

/// <summary>Offline tills: day-end upload and local-queue status reports.</summary>
[Authorize]
[Route("api/pos-offline")]
public sealed class OfflineSyncController(ISender sender) : BaseApiController(sender)
{
    [RequirePermission("pos.transactions.create")]
    [HttpPost("sync")]
    [RequestSizeLimit(20_000_000)]
    public async Task<IActionResult> Sync([FromBody] SyncOfflineDayCommand cmd, CancellationToken ct = default)
        => HandleResult(await Sender.Send(cmd, ct));

    [RequirePermission("pos.transactions.create")]
    [HttpPost("till-status")]
    public async Task<IActionResult> ReportTillStatus([FromBody] ReportTillStatusCommand cmd, CancellationToken ct = default)
        => HandleResult(await Sender.Send(cmd, ct));
}
