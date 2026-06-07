using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Softaxis.Construction.Infrastructure.Persistence;

namespace Softaxis.Construction.API.Controllers;

[ApiController][Route("api/construction/boqs")][Authorize]
public sealed class BOQController(ConstructionDbContext db) : ControllerBase
{
    [HttpGet("summary")]
    public async Task<IActionResult> GetSummary(CancellationToken ct)
    {
        var boqs = await db.BOQs.AsNoTracking().Where(x => !x.IsDeleted)
            .Select(x => new { x.Status }).ToListAsync(ct);

        var items = await db.BoqItems.AsNoTracking()
            .Select(x => new { x.Quantity, x.UnitRate, x.CompletedQty }).ToListAsync(ct);

        var totalValue     = items.Sum(i => i.Quantity * i.UnitRate);
        var completedValue = items.Sum(i => i.CompletedQty * i.UnitRate);

        return Ok(new {
            total        = boqs.Count,
            draft        = boqs.Count(x => x.Status == "draft"),
            approved     = boqs.Count(x => x.Status == "approved"),
            totalValue,
            completedValue,
            completionPct = totalValue > 0 ? Math.Round(completedValue / totalValue * 100, 1) : 0,
        });
    }

    [HttpGet]
    public async Task<IActionResult> GetAll(CancellationToken ct)
    {
        var list = await db.BOQs.AsNoTracking().Include(x => x.Items)
            .Where(x => !x.IsDeleted).OrderByDescending(x => x.CreatedAt).ToListAsync(ct);

        return Ok(list.Select(b => new {
            b.Id, b.ProjectId, b.ProjectName, b.Status,
            b.ApprovedBy, b.ApprovedDate,
            totalValue     = b.Items.Sum(i => i.Quantity * i.UnitRate),
            completedValue = b.Items.Sum(i => i.CompletedQty * i.UnitRate),
            items = b.Items.Select(i => new {
                i.Id, i.ItemCode, i.Description, i.Unit,
                i.Quantity, i.UnitRate,
                amount       = i.Quantity * i.UnitRate,
                i.CompletedQty,
                completedAmt = i.CompletedQty * i.UnitRate,
            }),
        }));
    }
}
