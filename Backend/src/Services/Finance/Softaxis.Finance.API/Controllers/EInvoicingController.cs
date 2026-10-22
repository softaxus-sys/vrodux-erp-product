using System.Security.Claims;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Finance.API.Authorization;
using Softaxis.Finance.API.Controllers.Common;
using Softaxis.Finance.Application.EInvoicing;

namespace Softaxis.Finance.API.Controllers;

/// <summary>
/// UAE e-invoicing (PINT AE): preview the XML for an invoice, download it, and send it to the
/// configured Accredited Service Provider. Uses the invoicing keys: view to read, edit to send.
/// </summary>
[ApiController]
[Route("api/finance/invoices/{invoiceId:guid}/einvoice")]
[Authorize]
public sealed class EInvoicingController(ISender sender) : FinanceControllerBase
{
    private string? CurrentUserId => User.FindFirstValue(ClaimTypes.NameIdentifier);
    private string? CurrentUserName =>
        User.FindFirstValue("username") ?? User.FindFirstValue(ClaimTypes.Name)
        ?? User.FindFirstValue("name") ?? User.FindFirstValue(ClaimTypes.Email);

    /// <summary>The XML as it would be sent now, its problems, and every past attempt.</summary>
    [HttpGet]
    [RequirePermission("finance.invoicing.view")]
    public async Task<IActionResult> Get(Guid invoiceId, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetEInvoiceStatusQuery(invoiceId), ct));

    /// <summary>Downloads the PINT AE XML.</summary>
    [HttpGet("xml")]
    [RequirePermission("finance.invoicing.view")]
    public async Task<IActionResult> Xml(Guid invoiceId, CancellationToken ct)
    {
        var result = await sender.Send(new GetEInvoiceStatusQuery(invoiceId), ct);
        if (!result.IsSuccess || result.Value.Xml is null) return OkOrError(result);
        return File(System.Text.Encoding.UTF8.GetBytes(result.Value.Xml), "application/xml",
            $"{result.Value.InvoiceNumber}.xml");
    }

    /// <summary>Sends the invoice to the ASP (or records why it could not).</summary>
    [HttpPost("submit")]
    [RequirePermission("finance.invoicing.edit")]
    public async Task<IActionResult> Submit(Guid invoiceId, CancellationToken ct) =>
        OkOrError(await sender.Send(new SubmitEInvoiceCommand(invoiceId, CurrentUserId, CurrentUserName), ct));
}
