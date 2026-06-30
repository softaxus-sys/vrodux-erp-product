using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Finance.API.Authorization;
using Softaxis.Finance.API.Controllers.Common;
using Softaxis.Finance.Application.Invoices.Commands;
using Softaxis.Finance.Application.Invoices.Dtos;
using Softaxis.Finance.Application.Invoices.Queries;

namespace Softaxis.Finance.API.Controllers;

[ApiController]
[Route("api/finance/invoices")]
[Authorize]
public sealed class InvoicesController(ISender sender) : FinanceControllerBase
{
    [HttpGet("summary")]
    [RequirePermission("finance.invoicing.view")]
    public async Task<IActionResult> GetSummary(CancellationToken ct)
    {
        var result = await sender.Send(new GetInvoicesSummaryQuery(), ct);
        return OkOrError(result);
    }

    [HttpGet]
    [RequirePermission("finance.invoicing.view")]
    public async Task<IActionResult> GetAll(
        [FromQuery] int     page     = 1,
        [FromQuery] int     pageSize = 20,
        [FromQuery] string? search   = null,
        [FromQuery] string? status   = null,
        CancellationToken ct = default)
    {
        var result = await sender.Send(new GetInvoicesQuery(page, pageSize, search, status), ct);
        return OkOrError(result);
    }

    [HttpGet("{id:guid}")]
    [RequirePermission("finance.invoicing.view")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new GetInvoiceByIdQuery(id), ct);
        return OkOrError(result);
    }

    [HttpPost]
    [RequirePermission("finance.invoicing.create")]
    public async Task<IActionResult> Create([FromBody] CreateInvoiceCommand cmd, CancellationToken ct)
    {
        var result = await sender.Send(cmd, ct);
        return CreatedOrError(result, nameof(GetById),
            result.IsSuccess ? new { id = result.Value.Id } : null!);
    }

    public sealed record UpdateInvoiceRequest(
        string CustomerName, string? CustomerEmail, string InvoiceDate, string DueDate,
        decimal TaxRate, string? Notes, string Status, IReadOnlyList<InvoiceItemRequest> Items);

    [HttpPut("{id:guid}")]
    [RequirePermission("finance.invoicing.edit")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateInvoiceRequest req, CancellationToken ct)
    {
        var result = await sender.Send(new UpdateInvoiceCommand(id, req.CustomerName, req.CustomerEmail,
            req.InvoiceDate, req.DueDate, req.TaxRate, req.Notes, req.Status, req.Items), ct);
        return NoContentOrError(result);
    }

    [HttpPost("{id:guid}/pay")]
    [RequirePermission("finance.invoicing.edit")]
    public async Task<IActionResult> MarkPaid(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new MarkInvoicePaidCommand(id), ct);
        return NoContentOrError(result);
    }

    [HttpPost("{id:guid}/send")]
    [RequirePermission("finance.invoicing.edit")]
    public async Task<IActionResult> Send(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new SendInvoiceCommand(id), ct);
        return NoContentOrError(result);
    }

    [HttpPost("{id:guid}/cancel")]
    [RequirePermission("finance.invoicing.edit")]
    public async Task<IActionResult> Cancel(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new CancelInvoiceCommand(id), ct);
        return NoContentOrError(result);
    }

    [HttpDelete("{id:guid}")]
    [RequirePermission("finance.invoicing.delete")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new DeleteInvoiceCommand(id), ct);
        return NoContentOrError(result);
    }
}
