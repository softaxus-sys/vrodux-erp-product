using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Finance.API.Controllers.Common;
using Softaxis.Finance.Application.RecurringInvoices.Commands;
using Softaxis.Finance.Application.RecurringInvoices.Dtos;
using Softaxis.Finance.Application.RecurringInvoices.Queries;

namespace Softaxis.Finance.API.Controllers;

[ApiController]
[Route("api/finance/recurring-invoices")]
[Authorize]
public sealed class RecurringInvoicesController(ISender sender) : FinanceControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var result = await sender.Send(new GetRecurringInvoicesQuery(), ct);
        return OkOrError(result);
    }

    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary(CancellationToken ct)
    {
        var result = await sender.Send(new GetRecurringInvoicesSummaryQuery(), ct);
        return OkOrError(result);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new GetRecurringInvoiceByIdQuery(id), ct);
        return OkOrError(result);
    }

    public sealed record LineRequest(string Description, decimal Quantity, decimal UnitPrice);

    public sealed record UpsertRequest(
        string TemplateName, string CustomerName, string? CustomerEmail,
        string Frequency, string StartDate, string? EndDate,
        int DueDays, decimal TaxRate, string? Notes, IReadOnlyList<LineRequest> Lines);

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] UpsertRequest req, CancellationToken ct)
    {
        var result = await sender.Send(new CreateRecurringInvoiceCommand(
            req.TemplateName, req.CustomerName, req.CustomerEmail, req.Frequency,
            req.StartDate, req.EndDate, req.DueDays, req.TaxRate, req.Notes,
            req.Lines.Select(l => new Application.RecurringInvoices.Dtos.LineRequest(l.Description, l.Quantity, l.UnitPrice)).ToList()), ct);

        return CreatedOrError(result, nameof(GetById), result.IsSuccess ? new { id = result.Value.Id } : null!);
    }

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpsertRequest req, CancellationToken ct)
    {
        var result = await sender.Send(new UpdateRecurringInvoiceCommand(
            id, req.TemplateName, req.CustomerName, req.CustomerEmail, req.Frequency,
            req.EndDate, req.DueDays, req.TaxRate, req.Notes,
            req.Lines.Select(l => new Application.RecurringInvoices.Dtos.LineRequest(l.Description, l.Quantity, l.UnitPrice)).ToList()), ct);

        return NoContentOrError(result);
    }

    [HttpPost("{id:guid}/pause")]
    public async Task<IActionResult> Pause(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new PauseRecurringInvoiceCommand(id), ct);
        return NoContentOrError(result);
    }

    [HttpPost("{id:guid}/resume")]
    public async Task<IActionResult> Resume(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new ResumeRecurringInvoiceCommand(id), ct);
        return NoContentOrError(result);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new DeleteRecurringInvoiceCommand(id), ct);
        return NoContentOrError(result);
    }

    /// <summary>Generate one invoice now from this template (advances the schedule).</summary>
    [HttpPost("{id:guid}/generate")]
    public async Task<IActionResult> GenerateNow(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new GenerateNowCommand(id), ct);
        return OkOrError(result);
    }

    /// <summary>Generate invoices for every template that is currently due.</summary>
    [HttpPost("run-due")]
    public async Task<IActionResult> RunDue(CancellationToken ct)
    {
        var result = await sender.Send(new RunDueCommand(), ct);
        return OkOrError(result);
    }
}
