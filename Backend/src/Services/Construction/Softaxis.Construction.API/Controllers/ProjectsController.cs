using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Construction.API.Controllers.Common;
using Softaxis.Construction.Application.Projects.Commands;
using Softaxis.Construction.Application.Projects.Queries;

namespace Softaxis.Construction.API.Controllers;

[ApiController][Route("api/construction/projects")][Authorize]
public sealed class ProjectsController(ISender sender) : ConstructionControllerBase
{
    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary(CancellationToken ct)
    {
        var result = await sender.Send(new GetProjectsSummaryQuery(), ct);
        return OkOrError(result);
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var result = await sender.Send(new GetProjectsQuery(), ct);
        return OkOrError(result);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> GetById(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new GetProjectByIdQuery(id), ct);
        return OkOrError(result);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateProjectCommand cmd, CancellationToken ct)
    {
        var result = await sender.Send(cmd, ct);
        return CreatedOrError(result, nameof(GetById), new { id = result.Value?.Id });
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        var result = await sender.Send(new DeleteProjectCommand(id), ct);
        return NoContentOrError(result);
    }
}
