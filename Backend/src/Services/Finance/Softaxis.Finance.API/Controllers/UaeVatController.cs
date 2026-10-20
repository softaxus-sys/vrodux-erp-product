using System.Security.Claims;
using System.Text;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Finance.API.Authorization;
using Softaxis.Finance.API.Controllers.Common;
using Softaxis.Finance.Application.UaeVat;

namespace Softaxis.Finance.API.Controllers;

/// <summary>
/// UAE VAT 201 returns: prepare from the ledger → approve → freeze files → submit (via the
/// configured gateway) or record an EmaraTax portal filing. Reuses the seeded <c>finance.tax.*</c>
/// keys: view to read, create to prepare, approve to sign off and send, edit for the registration.
/// </summary>
[ApiController]
[Route("api/finance/tax/uae")]
[Authorize]
public sealed class UaeVatController(ISender sender) : FinanceControllerBase
{
    private string? CurrentUserId => User.FindFirstValue(ClaimTypes.NameIdentifier);

    // Same claim order as JournalEntriesController ("username" is what the JWT actually carries).
    private string? CurrentUserName =>
        User.FindFirstValue("username")
        ?? User.FindFirstValue(ClaimTypes.Name)
        ?? User.FindFirstValue("name")
        ?? User.FindFirstValue(ClaimTypes.Email);

    [HttpGet("profile")]
    [RequirePermission("finance.tax.view")]
    public async Task<IActionResult> GetProfile(CancellationToken ct) =>
        OkOrError(await sender.Send(new GetUaeVatProfileQuery(), ct));

    [HttpPut("profile")]
    [RequirePermission("finance.tax.edit")]
    public async Task<IActionResult> UpsertProfile([FromBody] UpsertUaeVatProfileCommand cmd, CancellationToken ct) =>
        OkOrError(await sender.Send(cmd, ct));

    [HttpGet("integration")]
    [RequirePermission("finance.tax.view")]
    public async Task<IActionResult> GetIntegration(CancellationToken ct) =>
        OkOrError(await sender.Send(new GetUaeVatIntegrationQuery(), ct));

    [HttpGet("returns")]
    [RequirePermission("finance.tax.view")]
    public async Task<IActionResult> GetReturns([FromQuery] Guid? taxPeriodId, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetVatReturnsQuery(taxPeriodId), ct));

    [HttpGet("returns/{id:guid}")]
    [RequirePermission("finance.tax.view")]
    public async Task<IActionResult> GetReturn(Guid id, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetVatReturnByIdQuery(id), ct));

    [HttpPost("periods/{taxPeriodId:guid}/prepare")]
    [RequirePermission("finance.tax.create")]
    public async Task<IActionResult> Prepare(Guid taxPeriodId, CancellationToken ct) =>
        OkOrError(await sender.Send(new PrepareVatReturnCommand(taxPeriodId, CurrentUserName), ct));

    [HttpPost("returns/{id:guid}/approve")]
    [RequirePermission("finance.tax.approve")]
    public async Task<IActionResult> Approve(Guid id, CancellationToken ct) =>
        OkOrError(await sender.Send(new ApproveVatReturnCommand(id, CurrentUserId, CurrentUserName), ct));

    [HttpPost("returns/{id:guid}/ready")]
    [RequirePermission("finance.tax.approve")]
    public async Task<IActionResult> MarkReady(Guid id, CancellationToken ct) =>
        OkOrError(await sender.Send(new MarkVatReturnReadyCommand(id), ct));

    [HttpPost("returns/{id:guid}/submit")]
    [RequirePermission("finance.tax.approve")]
    public async Task<IActionResult> Submit(Guid id, CancellationToken ct) =>
        OkOrError(await sender.Send(new SubmitVatReturnCommand(id, CurrentUserName), ct));

    public sealed record PortalFilingRequest(string Reference);

    [HttpPost("returns/{id:guid}/portal-filing")]
    [RequirePermission("finance.tax.approve")]
    public async Task<IActionResult> RecordPortalFiling(Guid id, [FromBody] PortalFilingRequest req, CancellationToken ct) =>
        OkOrError(await sender.Send(new RecordVatPortalFilingCommand(id, req.Reference, CurrentUserName), ct));

    [HttpGet("returns/{id:guid}/files/{kind}")]
    [RequirePermission("finance.tax.view")]
    public async Task<IActionResult> Download(Guid id, string kind, CancellationToken ct)
    {
        var result = await sender.Send(new GetVatReturnFileQuery(id, kind.ToLowerInvariant()), ct);
        if (result.IsFailure) return OkOrError(result);
        return File(Encoding.UTF8.GetBytes(result.Value.Content), result.Value.ContentType, result.Value.FileName);
    }
}
