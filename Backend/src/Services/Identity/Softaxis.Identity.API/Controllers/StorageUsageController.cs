using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.Identity.Application.StorageUsage;

namespace Softaxis.Identity.API.Controllers;

/// <summary>
/// Super-admin only. Per-tenant breakdown of the shared object-storage bucket against its
/// provisioned budget — visibility only, nothing here enforces a limit. Part of the agreed
/// three-part storage-budget plan: per-file size caps (already in place per module) and image
/// compression (IImageProcessor) are the other two.
/// </summary>
[ApiController]
[Route("api/admin/storage-usage")]
[Produces("application/json")]
[Authorize(Policy = "SuperAdminOnly")]
public sealed class StorageUsageController(ISender sender) : BaseApiController(sender)
{
    // GET /api/admin/storage-usage
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct)
        => HandleResult(await Sender.Send(new GetStorageUsageQuery(), ct));
}
