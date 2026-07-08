using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.VisaServices.API.Authorization;
using Softaxis.VisaServices.API.Controllers.Common;
using Softaxis.VisaServices.Application.VisaCases.Queries;
using Softaxis.VisaServices.Application.VisaTypes.Commands;

namespace Softaxis.VisaServices.API.Controllers;

[ApiController][Route("api/visa/types")][Authorize]
public sealed class VisaTypesController(ISender sender) : VisaControllerBase
{
    // Reads feed the new-case wizard's type dropdown, so they stay open to any authenticated
    // user (the shared-reference-reads rule from the Finance/HR audits).
    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var result = await sender.Send(new GetVisaTypesQuery(), ct);
        return OkOrError(result);
    }

    // Catalogue management — gated on the nearest seeded key (no dedicated visa.types group).
    [HttpPost]
    [RequirePermission("visa.cases.edit")]
    public async Task<IActionResult> Create([FromBody] UpsertVisaTypeRequest req, CancellationToken ct)
    {
        var result = await sender.Send(new CreateVisaTypeCommand(req.Name, req.Category, req.Channel,
            req.DefaultGovtFee, req.DefaultServiceFee, req.ProcessingDays, req.RequiredDocuments ?? []), ct);
        return OkOrError(result);
    }

    [HttpPut("{id:guid}")]
    [RequirePermission("visa.cases.edit")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpsertVisaTypeRequest req, CancellationToken ct)
    {
        var result = await sender.Send(new UpdateVisaTypeCommand(id, req.Name, req.Category, req.Channel,
            req.DefaultGovtFee, req.DefaultServiceFee, req.ProcessingDays, req.RequiredDocuments ?? []), ct);
        return NoContentOrError(result);
    }

    [HttpDelete("{id:guid}")]
    [RequirePermission("visa.cases.edit")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new DeleteVisaTypeCommand(id), ct);
        return NoContentOrError(result);
    }

    public sealed record UpsertVisaTypeRequest(string Name, string Category, string Channel,
        decimal DefaultGovtFee, decimal DefaultServiceFee, int ProcessingDays, List<string>? RequiredDocuments);
}
