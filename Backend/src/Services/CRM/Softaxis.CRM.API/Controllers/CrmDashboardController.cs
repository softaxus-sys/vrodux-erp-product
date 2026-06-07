using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.API.Controllers;

[ApiController][Route("api/crm/dashboard")][Authorize]
public sealed class CrmDashboardController(CrmDbContext db) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken ct)
    {
        var leads = await db.Leads.AsNoTracking().Select(l => new { l.Status, l.Source, l.EstimatedValue }).ToListAsync(ct);
        var deals = await db.Deals.AsNoTracking().Select(d => new { d.Stage, d.Value }).ToListAsync(ct);

        string[] leadStages = ["new", "contacted", "qualified", "converted"];
        var funnel = leadStages.Select(s => new { stage = s, count = leads.Count(l => l.Status == s) }).ToList();

        var bySource = leads.GroupBy(l => string.IsNullOrWhiteSpace(l.Source) ? "other" : l.Source)
            .Select(g => new { source = g.Key, count = g.Count() })
            .OrderByDescending(x => x.count).ToList();

        string[] dealStages = ["lead", "qualified", "proposal", "negotiation", "won", "lost"];
        var pipeline = dealStages.Select(s => new
        {
            stage = s,
            count = deals.Count(d => d.Stage == s),
            value = deals.Where(d => d.Stage == s).Sum(d => d.Value),
        }).ToList();

        var won = deals.Where(d => d.Stage == "won").ToList();
        var lost = deals.Count(d => d.Stage == "lost");
        var openDeals = deals.Where(d => d.Stage is not "won" and not "lost").ToList();
        var totalClosed = won.Count + lost;

        var todayStr = DateTime.UtcNow.ToString("yyyy-MM-dd");
        var openActs = await db.Activities.AsNoTracking().Where(a => !a.Completed).Select(a => a.DueDate).ToListAsync(ct);

        return Ok(new
        {
            leadFunnel        = funnel,
            leadsBySource     = bySource,
            pipelineByStage   = pipeline,
            openPipelineValue = openDeals.Sum(d => d.Value),
            wonValue          = won.Sum(d => d.Value),
            wonCount          = won.Count,
            lostCount         = lost,
            winRate           = totalClosed > 0 ? Math.Round((double)won.Count / totalClosed * 100, 1) : 0,
            totalLeads        = leads.Count,
            totalDeals        = deals.Count,
            openTasks         = openActs.Count,
            overdueTasks      = openActs.Count(d => d != null && string.CompareOrdinal(d, todayStr) < 0),
        });
    }
}
