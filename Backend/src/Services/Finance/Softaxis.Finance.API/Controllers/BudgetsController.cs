using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Finance.API.Authorization;
using Softaxis.Finance.API.Controllers.Common;
using Softaxis.Finance.Application.Budgets.Commands;
using Softaxis.Finance.Application.Budgets.Dtos;
using Softaxis.Finance.Application.Budgets.Queries;

namespace Softaxis.Finance.API.Controllers;

[ApiController]
[Route("api/finance/budgets")]
[Authorize]
public sealed class BudgetsController(ISender sender) : FinanceControllerBase
{
    [HttpGet("summary")]
    [RequirePermission("finance.budgeting.view")]
    public async Task<IActionResult> GetSummary(CancellationToken ct)
    {
        var result = await sender.Send(new GetBudgetsSummaryQuery(), ct);
        return OkOrError(result);
    }

    [HttpGet]
    [RequirePermission("finance.budgeting.view")]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? period = null,
        [FromQuery] string? status = null,
        [FromQuery] string? search = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 30,
        CancellationToken ct = default)
    {
        var result = await sender.Send(new GetBudgetsQuery(period, status, search, page, pageSize), ct);
        return OkOrError(result);
    }

    [HttpGet("{id:guid}")]
    [RequirePermission("finance.budgeting.view")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new GetBudgetByIdQuery(id), ct);
        return OkOrError(result);
    }

    [HttpPost]
    [RequirePermission("finance.budgeting.create")]
    public async Task<IActionResult> Create([FromBody] CreateBudgetCommand cmd, CancellationToken ct)
    {
        var result = await sender.Send(cmd, ct);
        return CreatedOrError(result, nameof(GetById),
            result.IsSuccess ? new { id = result.Value.Id } : null!);
    }

    public sealed record UpdateBudgetRequest(
        string Name, string Period, string Status, string? Notes,
        IReadOnlyList<BudgetLineRequest> Lines);

    [HttpPut("{id:guid}")]
    [RequirePermission("finance.budgeting.edit")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateBudgetRequest req, CancellationToken ct)
    {
        var result = await sender.Send(new UpdateBudgetCommand(id, req.Name, req.Period, req.Status, req.Notes, req.Lines), ct);
        return NoContentOrError(result);
    }

    public sealed record ChangeStatusRequest(string Status);

    [HttpPost("{id:guid}/status")]
    [RequirePermission("finance.budgeting.approve")]
    public async Task<IActionResult> ChangeStatus(Guid id, [FromBody] ChangeStatusRequest req, CancellationToken ct)
    {
        var result = await sender.Send(new ChangeBudgetStatusCommand(id, req.Status), ct);
        return NoContentOrError(result);
    }

    // NOTE: budgeting has no seeded "delete" action — gate on "edit" (closest key) so admins keep working.
    [HttpDelete("{id:guid}")]
    [RequirePermission("finance.budgeting.edit")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new DeleteBudgetCommand(id), ct);
        return NoContentOrError(result);
    }
}
