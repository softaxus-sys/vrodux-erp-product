using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Finance.API.Controllers.Common;
using Softaxis.Finance.Application.Expenses.Commands;
using Softaxis.Finance.Application.Expenses.Queries;

namespace Softaxis.Finance.API.Controllers;

[ApiController]
[Route("api/finance/expenses")]
[Authorize]
public sealed class ExpensesController(ISender sender) : FinanceControllerBase
{
    public sealed record ApproveRequest(Guid ApproverId);

    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary(CancellationToken ct)
    {
        var result = await sender.Send(new GetExpensesSummaryQuery(), ct);
        return OkOrError(result);
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] int     page      = 1,
        [FromQuery] int     pageSize  = 20,
        [FromQuery] string? search    = null,
        [FromQuery] string? status    = null,
        [FromQuery] string? category  = null,
        [FromQuery] string? dateFrom  = null,
        [FromQuery] string? dateTo    = null,
        CancellationToken ct = default)
    {
        var result = await sender.Send(new GetExpensesQuery(page, pageSize, search, status, category, dateFrom, dateTo), ct);
        return OkOrError(result);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new GetExpenseByIdQuery(id), ct);
        return OkOrError(result);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateExpenseCommand cmd, CancellationToken ct)
    {
        var result = await sender.Send(cmd, ct);
        return CreatedOrError(result, nameof(GetById),
            result.IsSuccess ? new { id = result.Value.Id } : null!);
    }

    public sealed record UpdateExpenseRequest(
        string Title, string Category, decimal Amount, string ExpenseDate,
        string? PaidBy, string? PaymentMethod, string? Reference, string? Notes);

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateExpenseRequest req, CancellationToken ct)
    {
        var result = await sender.Send(new UpdateExpenseCommand(id, req.Title, req.Category, req.Amount,
            req.ExpenseDate, req.PaidBy, req.PaymentMethod, req.Reference, req.Notes), ct);
        return NoContentOrError(result);
    }

    [HttpPost("{id:guid}/approve")]
    public async Task<IActionResult> Approve(Guid id, [FromBody] ApproveRequest req, CancellationToken ct)
    {
        var result = await sender.Send(new ApproveExpenseCommand(id, req.ApproverId), ct);
        return NoContentOrError(result);
    }

    [HttpPost("{id:guid}/reject")]
    public async Task<IActionResult> Reject(Guid id, [FromBody] ApproveRequest req, CancellationToken ct)
    {
        var result = await sender.Send(new RejectExpenseCommand(id, req.ApproverId), ct);
        return NoContentOrError(result);
    }

    [HttpPost("{id:guid}/pay")]
    public async Task<IActionResult> MarkPaid(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new MarkExpensePaidCommand(id), ct);
        return NoContentOrError(result);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new DeleteExpenseCommand(id), ct);
        return NoContentOrError(result);
    }
}
