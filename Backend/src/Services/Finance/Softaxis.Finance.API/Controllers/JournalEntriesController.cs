using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Finance.API.Authorization;
using Softaxis.Finance.API.Controllers.Common;
using Softaxis.Finance.Application.JournalEntries.Commands;
using Softaxis.Finance.Application.JournalEntries.Queries;

namespace Softaxis.Finance.API.Controllers;

[ApiController]
[Route("api/finance/journal-entries")]
[Authorize]
public sealed class JournalEntriesController(ISender sender) : FinanceControllerBase
{
    [HttpGet]
    [RequirePermission("finance.journals.view")]
    public async Task<IActionResult> GetAll(
        [FromQuery] int     page     = 1,
        [FromQuery] int     pageSize = 20,
        [FromQuery] string? search   = null,
        [FromQuery] string? status   = null,
        [FromQuery] string? dateFrom = null,
        [FromQuery] string? dateTo   = null,
        CancellationToken ct = default)
    {
        var result = await sender.Send(new GetJournalEntriesQuery(page, pageSize, search, status, dateFrom, dateTo), ct);
        return OkOrError(result);
    }

    [HttpGet("{id:guid}")]
    [RequirePermission("finance.journals.view")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new GetJournalEntryByIdQuery(id), ct);
        return OkOrError(result);
    }

    [HttpPost]
    [RequirePermission("finance.journals.create")]
    public async Task<IActionResult> Create([FromBody] CreateJournalEntryCommand cmd, CancellationToken ct)
    {
        var result = await sender.Send(cmd, ct);
        return CreatedOrError(result, nameof(GetById),
            result.IsSuccess ? new { id = result.Value.Id } : null!);
    }

    [HttpPost("{id:guid}/post")]
    [RequirePermission("finance.journals.approve")]
    public async Task<IActionResult> Post(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new PostJournalEntryCommand(id), ct);
        return NoContentOrError(result);
    }

    [HttpPost("{id:guid}/void")]
    [RequirePermission("finance.journals.approve")]
    public async Task<IActionResult> Void(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new VoidJournalEntryCommand(id), ct);
        return NoContentOrError(result);
    }

    // NOTE: journals has no seeded "delete" action — gate on "edit" (closest key) so admins keep working.
    [HttpDelete("{id:guid}")]
    [RequirePermission("finance.journals.edit")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new DeleteJournalEntryCommand(id), ct);
        return NoContentOrError(result);
    }
}
