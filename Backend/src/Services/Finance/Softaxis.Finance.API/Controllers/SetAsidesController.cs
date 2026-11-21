using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Finance.API.Authorization;
using Softaxis.Finance.API.Controllers.Common;
using Softaxis.Finance.Application.SetAsides;

namespace Softaxis.Finance.API.Controllers;

/// <summary>
/// Optional set-asides: a share of invoice income (e.g. charity) the business chooses to put
/// aside. A workspace that never creates a rule is unaffected by any of this.
/// </summary>
[ApiController]
[Route("api/finance/set-asides")]
[Authorize]
public sealed class SetAsidesController(ISender sender) : FinanceControllerBase
{
    public sealed record SaveRuleRequest(string Name, string Kind, decimal Value, bool AutoApply = true, bool IsActive = true);

    public sealed record PayRequest(
        IReadOnlyList<Guid> EntryIds, string PaidOn, string FromAccountNumber, string? Reference = null, string? Notes = null);

    // Rules are read by the invoice form (to offer them), so invoicing access is enough to see them.
    [HttpGet("rules")]
    [RequirePermission("finance.invoicing.view,finance.accounting.view")]
    public async Task<IActionResult> GetRules(CancellationToken ct)
        => OkOrError(await sender.Send(new GetSetAsideRulesQuery(), ct));

    [HttpPost("rules")]
    [RequirePermission("finance.accounting.edit")]
    public async Task<IActionResult> CreateRule([FromBody] SaveRuleRequest req, CancellationToken ct)
        => OkOrError(await sender.Send(new SaveSetAsideRuleCommand(null, req.Name, req.Kind, req.Value, req.AutoApply, req.IsActive), ct));

    [HttpPut("rules/{id:guid}")]
    [RequirePermission("finance.accounting.edit")]
    public async Task<IActionResult> UpdateRule(Guid id, [FromBody] SaveRuleRequest req, CancellationToken ct)
        => OkOrError(await sender.Send(new SaveSetAsideRuleCommand(id, req.Name, req.Kind, req.Value, req.AutoApply, req.IsActive), ct));

    [HttpDelete("rules/{id:guid}")]
    [RequirePermission("finance.accounting.edit")]
    public async Task<IActionResult> DeleteRule(Guid id, CancellationToken ct)
        => NoContentOrError(await sender.Send(new DeleteSetAsideRuleCommand(id), ct));

    [HttpGet("dashboard")]
    [RequirePermission("finance.accounting.view")]
    public async Task<IActionResult> Dashboard([FromQuery] string? from, [FromQuery] string? to, CancellationToken ct)
        => OkOrError(await sender.Send(new GetSetAsideDashboardQuery(from, to), ct));

    [HttpPost("payouts")]
    [RequirePermission("finance.accounting.edit")]
    public async Task<IActionResult> Pay([FromBody] PayRequest req, CancellationToken ct)
        => OkOrError(await sender.Send(new PaySetAsidesCommand(req.EntryIds, req.PaidOn, req.FromAccountNumber, req.Reference, req.Notes), ct));

    [HttpDelete("payouts/{id:guid}")]
    [RequirePermission("finance.accounting.edit")]
    public async Task<IActionResult> UndoPayout(Guid id, CancellationToken ct)
        => NoContentOrError(await sender.Send(new UndoSetAsidePayoutCommand(id), ct));
}
