using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.CRM.API.Controllers.Common;
using Softaxis.CRM.Application.LeadIntake.Commands;

namespace Softaxis.CRM.API.Controllers;

/// <summary>
/// The single internal pipeline entry point. Every in-app lead source funnels through here
/// (mapping → dedupe → create → routing → notifications) instead of writing leads directly.
/// Authenticated; tenant is taken from the JWT.
/// </summary>
[ApiController]
[Route("api/internal/leads")]
[Authorize]
public sealed class InternalLeadsController(ISender sender) : CrmControllerBase
{
    [HttpPost]
    public async Task<IActionResult> Ingest([FromBody] IngestLeadInput lead, CancellationToken ct) =>
        OkOrError(await sender.Send(new IngestLeadCommand(lead), ct));
}
