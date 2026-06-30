using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Finance.API.Authorization;
using Softaxis.Finance.API.Controllers.Common;
using Softaxis.Finance.Application.Journals.Queries;

namespace Softaxis.Finance.API.Controllers;

/// <summary>
/// Frontend-facing alias at /api/finance/journals with additional /summary endpoint.
/// The original /api/finance/journal-entries controller is preserved for backward compatibility.
/// </summary>
[ApiController]
[Route("api/finance/journals")]
[Authorize]
public sealed class JournalsController(ISender sender) : FinanceControllerBase
{
    [HttpGet("summary")]
    [RequirePermission("finance.journals.view")]
    public async Task<IActionResult> GetSummary(CancellationToken ct)
    {
        var result = await sender.Send(new GetJournalsSummaryQuery(), ct);
        return OkOrError(result);
    }

    [HttpGet]
    [RequirePermission("finance.journals.view")]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? search = null,
        [FromQuery] string? status = null,
        CancellationToken ct = default)
    {
        var result = await sender.Send(new GetJournalsQuery(search, status), ct);
        return OkOrError(result);
    }

    [HttpGet("{id:guid}")]
    [RequirePermission("finance.journals.view")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new GetJournalByIdQuery(id), ct);
        return OkOrError(result);
    }
}
