using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Inventory.API.Authorization;
using Softaxis.Inventory.Application.ProductImport;

namespace Softaxis.Inventory.API.Controllers;

/// <summary>
/// Bulk creation of stock items from a file, with picture links downloaded in the background. Running the same
/// file again is safe: items already in stock are left as they are.
/// </summary>
[Authorize]
[Route("api/inventory/product-import")]
[Tags("Product import")]
public sealed class ProductImportController(ISender sender) : BaseApiController(sender)
{
    [HttpPost]
    [RequirePermission("inventory.stock.create")]
    public async Task<IActionResult> Import([FromBody] ImportProductsCommand cmd, CancellationToken ct)
        => HandleResult(await Sender.Send(cmd, ct));

    /// <summary>How the background picture downloads are going, and which ones failed and why.</summary>
    [HttpGet("photos")]
    [RequirePermission("inventory.stock.view")]
    public async Task<IActionResult> PhotoStatus(CancellationToken ct)
        => HandleResult(await Sender.Send(new GetImportPhotoStatusQuery(), ct));

    [HttpPost("photos/retry-failed")]
    [RequirePermission("inventory.stock.edit")]
    public async Task<IActionResult> RetryFailed(CancellationToken ct)
        => HandleResult(await Sender.Send(new RetryFailedImportPhotosCommand(), ct));
}
