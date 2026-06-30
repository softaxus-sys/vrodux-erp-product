using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Finance.API.Authorization;
using Softaxis.Finance.API.Controllers.Common;
using Softaxis.Finance.Application.Expenses.Commands;
using Softaxis.Finance.Application.Expenses.Queries;
using Softaxis.Finance.Application.Expenses.Dtos;

namespace Softaxis.Finance.API.Controllers;

[ApiController]
[Route("api/finance/expenses")]
[Authorize]
public sealed class ExpensesController(ISender sender) : FinanceControllerBase
{
    public sealed record ApproveRequest(Guid ApproverId);

    [HttpGet("summary")]
    [RequirePermission("finance.expenses.view")]
    public async Task<IActionResult> GetSummary(CancellationToken ct)
    {
        var result = await sender.Send(new GetExpensesSummaryQuery(), ct);
        return OkOrError(result);
    }

    [HttpGet]
    [RequirePermission("finance.expenses.view")]
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
    [RequirePermission("finance.expenses.view")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new GetExpenseByIdQuery(id), ct);
        return OkOrError(result);
    }

    [HttpPost]
    [RequirePermission("finance.expenses.create")]
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
    [RequirePermission("finance.expenses.edit")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateExpenseRequest req, CancellationToken ct)
    {
        var result = await sender.Send(new UpdateExpenseCommand(id, req.Title, req.Category, req.Amount,
            req.ExpenseDate, req.PaidBy, req.PaymentMethod, req.Reference, req.Notes), ct);
        return NoContentOrError(result);
    }

    [HttpPost("{id:guid}/approve")]
    [RequirePermission("finance.expenses.approve")]
    public async Task<IActionResult> Approve(Guid id, [FromBody] ApproveRequest req, CancellationToken ct)
    {
        var result = await sender.Send(new ApproveExpenseCommand(id, req.ApproverId), ct);
        return NoContentOrError(result);
    }

    [HttpPost("{id:guid}/reject")]
    [RequirePermission("finance.expenses.approve")]
    public async Task<IActionResult> Reject(Guid id, [FromBody] ApproveRequest req, CancellationToken ct)
    {
        var result = await sender.Send(new RejectExpenseCommand(id, req.ApproverId), ct);
        return NoContentOrError(result);
    }

    [HttpPost("{id:guid}/pay")]
    [RequirePermission("finance.expenses.edit")]
    public async Task<IActionResult> MarkPaid(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new MarkExpensePaidCommand(id), ct);
        return NoContentOrError(result);
    }

    [HttpDelete("{id:guid}")]
    [RequirePermission("finance.expenses.delete")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new DeleteExpenseCommand(id), ct);
        return NoContentOrError(result);
    }

    [HttpPost("{id:guid}/receipt")]
    [RequestSizeLimit(6 * 1024 * 1024)]
    [RequirePermission("finance.expenses.edit")]
    public async Task<IActionResult> UploadReceipt(Guid id, IFormFile file, CancellationToken ct)
    {
        if (file is null || file.Length == 0)
            return BadRequest(new { error = "No file uploaded." });

        using var ms = new MemoryStream();
        await file.CopyToAsync(ms, ct);

        var result = await sender.Send(new UploadExpenseReceiptCommand(
            id, ms.ToArray(), file.FileName, file.ContentType ?? "application/octet-stream"), ct);
        return NoContentOrError(result);
    }

    [HttpGet("{id:guid}/receipt")]
    [RequirePermission("finance.expenses.view")]
    public async Task<IActionResult> GetReceipt(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new GetExpenseReceiptQuery(id), ct);
        if (!result.IsSuccess)
            return OkOrError(result);

        var r = result.Value;
        // Inline so browsers preview images/PDFs in a new tab rather than force-download.
        Response.Headers.ContentDisposition = $"inline; filename=\"{r.FileName}\"";
        return File(r.Data, r.ContentType);
    }

    [HttpDelete("{id:guid}/receipt")]
    [RequirePermission("finance.expenses.edit")]
    public async Task<IActionResult> DeleteReceipt(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new DeleteExpenseReceiptCommand(id), ct);
        return NoContentOrError(result);
    }
}
