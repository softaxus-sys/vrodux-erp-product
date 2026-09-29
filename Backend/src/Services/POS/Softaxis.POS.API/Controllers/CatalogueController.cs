using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.POS.API.Authorization;
using Softaxis.POS.Application.Catalogue.Commands;
using Softaxis.POS.Application.Catalogue.Queries;

namespace Softaxis.POS.API.Controllers;

/// <summary>Bundled product catalogue packs (country x industry) that a store can import on demand.</summary>
[Authorize]
public sealed class CatalogueController(ISender sender) : BaseApiController(sender)
{
    [RequirePermission("pos.products.view")]
    [HttpGet("packs")]
    public async Task<IActionResult> GetPacks(CancellationToken ct = default)
        => HandleResult(await Sender.Send(new GetCataloguePacksQuery(), ct));

    [RequirePermission("pos.products.create")]
    [HttpPost("import")]
    public async Task<IActionResult> Import([FromBody] ImportCatalogueCommand cmd, CancellationToken ct = default)
        => HandleResult(await Sender.Send(cmd, ct));
}
