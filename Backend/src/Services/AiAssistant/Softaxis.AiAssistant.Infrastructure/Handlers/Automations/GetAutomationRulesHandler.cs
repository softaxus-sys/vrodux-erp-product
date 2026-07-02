using Microsoft.EntityFrameworkCore;
using Softaxis.AiAssistant.Application.Automations.Dtos;
using Softaxis.AiAssistant.Application.Automations.Queries;
using Softaxis.AiAssistant.Infrastructure.Persistence;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;

namespace Softaxis.AiAssistant.Infrastructure.Handlers.Automations;

internal sealed class GetAutomationRulesHandler(AiAssistantDbContext db)
    : IQueryHandler<GetAutomationRulesQuery, IReadOnlyList<AutomationRuleSummaryDto>>
{
    public async Task<Result<IReadOnlyList<AutomationRuleSummaryDto>>> Handle(
        GetAutomationRulesQuery request, CancellationToken ct)
    {
        var rules = await db.AutomationRules.AsNoTracking()
            .OrderByDescending(r => r.CreatedAt)
            .ToListAsync(ct);

        // How many runs are waiting on approval, per rule (drives the "needs attention" badge).
        var pending = await db.AutomationRuns.AsNoTracking()
            .Where(x => x.Status == "pending_confirmation")
            .GroupBy(x => x.RuleId)
            .Select(g => new { RuleId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(x => x.RuleId, x => x.Count, ct);

        IReadOnlyList<AutomationRuleSummaryDto> list = rules
            .Select(r => AutomationMappings.ToSummary(r, pending.GetValueOrDefault(r.Id)))
            .ToList();

        return Result.Success(list);
    }
}

internal sealed class GetAutomationRuleByIdHandler(AiAssistantDbContext db)
    : IQueryHandler<GetAutomationRuleByIdQuery, AutomationRuleDto>
{
    public async Task<Result<AutomationRuleDto>> Handle(GetAutomationRuleByIdQuery request, CancellationToken ct)
    {
        var rule = await db.AutomationRules.AsNoTracking()
            .FirstOrDefaultAsync(r => r.Id == request.Id, ct);
        if (rule is null)
            return Result.Failure<AutomationRuleDto>(Error.Custom("AutomationRule.NotFound", "Automation rule not found."));

        var runs = await db.AutomationRuns.AsNoTracking()
            .Where(x => x.RuleId == rule.Id)
            .OrderByDescending(x => x.StartedAt)
            .Take(20)
            .ToListAsync(ct);

        var runDtos = runs.Select(AutomationMappings.ToRunDto).ToList();
        return Result.Success(AutomationMappings.ToDto(rule, runDtos));
    }
}
