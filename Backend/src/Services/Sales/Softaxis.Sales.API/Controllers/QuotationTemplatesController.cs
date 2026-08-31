using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Sales.API.Authorization;
using Softaxis.Sales.API.Controllers.Common;
using Softaxis.Sales.Application.Quotations.Commands;
using Softaxis.Sales.Application.Quotations.Queries;

namespace Softaxis.Sales.API.Controllers;

/// <summary>
/// Reusable quotation templates: the boilerplate a tenant repeats on every proposal.
///
/// Gated on the quotation permission keys rather than new ones — a template is not a separate
/// resource a role would be granted independently, it is how quotations get written. Reads are
/// open to anyone who can view quotations so the "new from template" picker works for a rep who
/// cannot edit the templates themselves.
/// </summary>
[ApiController]
[Route("api/sales/quotation-templates")]
[Authorize]
public sealed class QuotationTemplatesController(ISender sender) : SalesControllerBase
{
    [HttpGet]
    [RequirePermission("sales.quotations.view")]
    public async Task<IActionResult> GetAll([FromQuery] bool includeInactive = false, CancellationToken ct = default)
        => OkOrError(await sender.Send(new GetQuotationTemplatesQuery(includeInactive), ct));

    [HttpGet("{id:guid}")]
    [RequirePermission("sales.quotations.view")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
        => OkOrError(await sender.Send(new GetQuotationTemplateByIdQuery(id), ct));

    [HttpPost]
    [RequirePermission("sales.quotations.create")]
    public async Task<IActionResult> Create([FromBody] CreateQuotationTemplateCommand cmd, CancellationToken ct)
    {
        var result = await sender.Send(cmd, ct);
        return result.IsSuccess
            ? CreatedOrError(result, nameof(GetById), new { id = result.Value.Id })
            : OkOrError(result);
    }

    [HttpPut("{id:guid}")]
    [RequirePermission("sales.quotations.edit")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateTemplateBody body, CancellationToken ct)
        => OkOrError(await sender.Send(new UpdateQuotationTemplateCommand(
            id, body.Name, body.Description, body.TitleTemplate, body.CoverNote,
            body.TermsAndConditions, body.PaymentTerms, body.FooterNote,
            body.ValidityDays, body.DefaultTaxRate, body.DefaultDiscount,
            body.AccentColor, body.ShowLogo, body.CustomFields,
            body.IsDefault, body.IsActive, body.Items), ct));

    [HttpDelete("{id:guid}")]
    [RequirePermission("sales.quotations.delete")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
        => NoContentOrError(await sender.Send(new DeleteQuotationTemplateCommand(id), ct));

    public sealed record UpdateTemplateBody(
        string  Name,
        string? Description,
        string? TitleTemplate,
        string? CoverNote,
        string? TermsAndConditions,
        string? PaymentTerms,
        string? FooterNote,
        int     ValidityDays,
        decimal DefaultTaxRate,
        decimal DefaultDiscount,
        string? AccentColor,
        bool    ShowLogo,
        Dictionary<string, string>? CustomFields,
        bool    IsDefault,
        bool    IsActive,
        IReadOnlyList<QuotationTemplateItemRequest> Items);
}
