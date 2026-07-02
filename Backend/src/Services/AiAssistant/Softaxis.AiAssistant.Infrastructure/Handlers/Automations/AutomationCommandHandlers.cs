using Microsoft.EntityFrameworkCore;
using Softaxis.AiAssistant.Application.Abstractions;
using Softaxis.AiAssistant.Application.Automations.Commands;
using Softaxis.AiAssistant.Application.Automations.Dtos;
using Softaxis.AiAssistant.Domain.Entities;
using Softaxis.AiAssistant.Infrastructure.Persistence;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.BuildingBlocks.Infrastructure.Persistence;

namespace Softaxis.AiAssistant.Infrastructure.Handlers.Automations;

internal sealed class CreateAutomationRuleHandler(AiAssistantDbContext db, ICurrentUser currentUser)
    : ICommandHandler<CreateAutomationRuleCommand, AutomationRuleDto>
{
    public async Task<Result<AutomationRuleDto>> Handle(CreateAutomationRuleCommand cmd, CancellationToken ct)
    {
        var runAsId = cmd.RunAsUserId ?? currentUser.Id ?? Guid.Empty;
        if (runAsId == Guid.Empty)
            return Result.Failure<AutomationRuleDto>(Error.Custom("AutomationRule.Invalid", "A run-as user is required."));

        // Tier gating — a tenant can only create automations (and autopilot ones) its plan allows.
        var settings = await db.AiSettings.AsNoTracking().FirstOrDefaultAsync(ct);
        var caps = Domain.AiTierCapabilities.For(settings?.Tier);
        if (!caps.Automations)
            return Result.Failure<AutomationRuleDto>(Error.Custom("AutomationRule.Forbidden",
                "Automations require the Growth or Enterprise plan."));
        if (!caps.UnlimitedAutomationRules)
        {
            var count = await db.AutomationRules.CountAsync(ct);
            if (count >= caps.MaxAutomationRules)
                return Result.Failure<AutomationRuleDto>(Error.Custom("AutomationRule.Forbidden",
                    $"You've reached your plan's limit of {caps.MaxAutomationRules} automations."));
        }
        // Coerce autopilot down to confirm when the tier doesn't include it (defence in depth).
        var mode = string.Equals(cmd.Mode, "autopilot", StringComparison.OrdinalIgnoreCase) && !caps.Autopilot
            ? "confirm" : cmd.Mode;

        var runAsName = ResolveRunAsName(cmd.RunAsUserId, cmd.RunAsUserName, currentUser);

        var rule = new AiAutomationRule(
            cmd.Name, cmd.Description, cmd.Agent, cmd.Instruction, runAsId, runAsName, mode,
            AutomationMappings.ParseFrequency(cmd.Frequency),
            cmd.IntervalMinutes, cmd.HourUtc, cmd.MinuteUtc, cmd.DayOfWeekUtc,
            cmd.NotifyTelegram, cmd.Enabled, cmd.TriggerType, cmd.EventKey);

        db.AutomationRules.Add(rule);
        await db.SaveChangesAsync(ct);

        return Result.Success(AutomationMappings.ToDto(rule, []));
    }

    internal static string ResolveRunAsName(Guid? runAsUserId, string? runAsUserName, ICurrentUser currentUser)
    {
        if (!string.IsNullOrWhiteSpace(runAsUserName)) return runAsUserName.Trim();
        if (runAsUserId is null || runAsUserId == currentUser.Id)
            return currentUser.Username ?? currentUser.Email ?? "User";
        return "User";
    }
}

internal sealed class UpdateAutomationRuleHandler(AiAssistantDbContext db, ICurrentUser currentUser)
    : ICommandHandler<UpdateAutomationRuleCommand, AutomationRuleDto>
{
    public async Task<Result<AutomationRuleDto>> Handle(UpdateAutomationRuleCommand cmd, CancellationToken ct)
    {
        var rule = await db.AutomationRules.FirstOrDefaultAsync(r => r.Id == cmd.Id, ct);
        if (rule is null)
            return Result.Failure<AutomationRuleDto>(Error.Custom("AutomationRule.NotFound", "Automation rule not found."));

        var runAsId = cmd.RunAsUserId ?? rule.RunAsUserId;
        var runAsName = CreateAutomationRuleHandler.ResolveRunAsName(cmd.RunAsUserId, cmd.RunAsUserName, currentUser);
        if (cmd.RunAsUserId is null) runAsName = rule.RunAsUserName; // unchanged run-as → keep the stored name

        // Coerce autopilot down to confirm when the tier doesn't include it.
        var settings = await db.AiSettings.AsNoTracking().FirstOrDefaultAsync(ct);
        var caps = Domain.AiTierCapabilities.For(settings?.Tier);
        var mode = string.Equals(cmd.Mode, "autopilot", StringComparison.OrdinalIgnoreCase) && !caps.Autopilot
            ? "confirm" : cmd.Mode;

        rule.Update(
            cmd.Name, cmd.Description, cmd.Agent, cmd.Instruction, runAsId, runAsName, mode,
            AutomationMappings.ParseFrequency(cmd.Frequency),
            cmd.IntervalMinutes, cmd.HourUtc, cmd.MinuteUtc, cmd.DayOfWeekUtc, cmd.NotifyTelegram,
            cmd.TriggerType, cmd.EventKey);

        await db.SaveChangesAsync(ct);
        return Result.Success(AutomationMappings.ToDto(rule, []));
    }
}

internal sealed class ToggleAutomationRuleHandler(AiAssistantDbContext db)
    : ICommandHandler<ToggleAutomationRuleCommand, AutomationRuleDto>
{
    public async Task<Result<AutomationRuleDto>> Handle(ToggleAutomationRuleCommand cmd, CancellationToken ct)
    {
        var rule = await db.AutomationRules.FirstOrDefaultAsync(r => r.Id == cmd.Id, ct);
        if (rule is null)
            return Result.Failure<AutomationRuleDto>(Error.Custom("AutomationRule.NotFound", "Automation rule not found."));

        rule.SetEnabled(cmd.Enabled);
        await db.SaveChangesAsync(ct);
        return Result.Success(AutomationMappings.ToDto(rule, []));
    }
}

internal sealed class DeleteAutomationRuleHandler(AiAssistantDbContext db)
    : ICommandHandler<DeleteAutomationRuleCommand>
{
    public async Task<Result> Handle(DeleteAutomationRuleCommand cmd, CancellationToken ct)
    {
        var rule = await db.AutomationRules.FirstOrDefaultAsync(r => r.Id == cmd.Id, ct);
        if (rule is null)
            return Result.Failure(Error.Custom("AutomationRule.NotFound", "Automation rule not found."));

        // Remove run history too so we don't leave orphaned rows.
        var runs = await db.AutomationRuns.Where(x => x.RuleId == rule.Id).ToListAsync(ct);
        db.AutomationRuns.RemoveRange(runs);
        db.AutomationRules.Remove(rule);
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

internal sealed class RunAutomationRuleNowHandler(AiAssistantDbContext db, IAiAutomationRunner runner)
    : ICommandHandler<RunAutomationRuleNowCommand, AutomationRunDto>
{
    public async Task<Result<AutomationRunDto>> Handle(RunAutomationRuleNowCommand cmd, CancellationToken ct)
    {
        var rule = await db.AutomationRules.FirstOrDefaultAsync(r => r.Id == cmd.Id, ct);
        if (rule is null)
            return Result.Failure<AutomationRunDto>(Error.Custom("AutomationRule.NotFound", "Automation rule not found."));

        var tenantId = (Guid?)db.Entry(rule).Property(TenantIsolation.Column).CurrentValue;
        if (tenantId is null)
            return Result.Failure<AutomationRunDto>(Error.Custom("AutomationRule.Invalid", "Rule has no tenant."));

        var run = await runner.RunAsync(rule, tenantId.Value, "manual", ct);
        return Result.Success(AutomationMappings.ToRunDto(run));
    }
}
