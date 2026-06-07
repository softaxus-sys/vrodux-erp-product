using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.POS.Application.Categories.Commands.CreateCategory;
using Softaxis.POS.Application.Categories.Commands.DeleteCategory;
using Softaxis.POS.Application.Categories.Commands.UpdateCategory;
using Softaxis.POS.Application.Categories.Queries.GetCategories;

namespace Softaxis.POS.API.Controllers;

[Authorize]
public sealed class CategoriesController(ISender sender) : BaseApiController(sender)
{
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        [FromQuery] string? search = null,
        [FromQuery] bool? isActive = null,
        CancellationToken ct = default)
        => HandleResult(await Sender.Send(new GetCategoriesQuery(page, pageSize, search, isActive), ct));

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateCategoryCommand cmd, CancellationToken ct = default)
        => HandleResult(await Sender.Send(cmd, ct), successCode: 201);

    [HttpPut("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateCategoryCommand cmd, CancellationToken ct = default)
    {
        if (id != cmd.Id) return BadRequest("ID mismatch.");
        return HandleResult(await Sender.Send(cmd, ct));
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct = default)
        => HandleResult(await Sender.Send(new DeleteCategoryCommand(id), ct));
}
