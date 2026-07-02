using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Softaxis.AiAssistant.Application.Abstractions;
using Softaxis.AiAssistant.Domain.Entities;
using Softaxis.AiAssistant.Infrastructure.Persistence;
using Softaxis.AiAssistant.Infrastructure.Telegram;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.Identity.Application.Auth.Commands.IssueServiceToken;

namespace Softaxis.AiAssistant.Infrastructure.Automation;

/// <summary>
/// Runs one automation rule end to end. Scopes the ambient tenant to the rule's tenant for the whole
/// operation (so every DB read/write + the tenant's AI settings resolve correctly), mints a service
/// token for the run-as user, and runs the orchestrator under an <see cref="AiImpersonation"/> scope
/// so all tools execute with that user's permissions — never crossing the tenant or exceeding rights.
/// </summary>
public sealed class AiAutomationRunner(
    AiAssistantDbContext db,
    ISender sender,
    IAiOrchestrator orchestrator,
    ISecretProtector protector,
    TelegramClient telegram,
    IConfiguration configuration,
    ILogger<AiAutomationRunner> logger) : IAiAutomationRunner
{
    public async Task<AiAutomationRun> RunAsync(
        AiAutomationRule rule, Guid tenantId, string triggeredBy, CancellationToken ct,
        string? triggerContext = null)
    {
        var prevTenant   = TenantAmbient.TenantId;
        var prevSuper    = TenantAmbient.IsSuperAdmin;
        var prevResolved = TenantAmbient.IsResolved;

        // Scope everything below to the rule's tenant so the AI settings + all writes are correct.
        TenantAmbient.Set(tenantId, isSuperAdmin: false, isResolved: true);
        try
        {
            var run = new AiAutomationRun(rule.Id, rule.Name, rule.RunAsUserId, triggeredBy);
            db.AutomationRuns.Add(run);
            await db.SaveChangesAsync(ct);

            var tokenResult = await sender.Send(new IssueServiceTokenCommand(rule.RunAsUserId), ct);
            if (tokenResult.IsFailure)
            {
                run.Complete("failed", null, null, "The run-as user is no longer eligible (locked, unverified, or deleted).");
                rule.RecordRun("failed", run.Error, DateTime.UtcNow);
                await db.SaveChangesAsync(ct);
                return run;
            }
            var tok = tokenResult.Value;
            var baseUrl = ResolveBaseUrl();

            // Re-check the tier at run time so a downgraded tenant can't keep running premium/autopilot
            // rules (single source of truth: AiTierCapabilities).
            var settings = await db.AiSettings.AsNoTracking().FirstOrDefaultAsync(ct);
            var caps = Domain.AiTierCapabilities.For(settings?.Tier);
            if (!caps.Automations)
            {
                run.Complete("failed", null, null, "Automations aren't available on your current plan.");
                rule.RecordRun("failed", run.Error, DateTime.UtcNow);
                await db.SaveChangesAsync(ct);
                return run;
            }
            var autopilot = rule.Mode == "autopilot" && caps.Autopilot;
            var instruction = string.IsNullOrWhiteSpace(triggerContext)
                ? rule.Instruction
                : $"{rule.Instruction}\n\n{triggerContext}";

            AiAssistant.Application.Chat.Dtos.AiAutonomousResult result;
            using (AiImpersonation.Use(new AiImpersonatedUser(
                tok.UserId, tok.Username, tok.Email, tok.IsSuperAdmin,
                tok.Permissions.ToHashSet(StringComparer.Ordinal), tok.AccessToken, baseUrl)))
            {
                result = await orchestrator.RunAutonomousAsync(instruction, rule.Agent, autopilot, ct);
            }

            if (result.Status == "pending_confirmation" && result.Pending is { } p)
                run.SetPending(p.ToolName, p.ArgumentsJson, result.Reply, result.ToolsUsed);
            else if (result.Status == "success")
                run.Complete("success", result.Reply, result.ToolsUsed, null);
            else
                run.Complete("failed", string.IsNullOrWhiteSpace(result.Reply) ? null : result.Reply, result.ToolsUsed, result.Error);

            rule.RecordRun(run.Status, run.Error, DateTime.UtcNow);
            await db.SaveChangesAsync(ct);

            if (rule.NotifyTelegram && run.Status != "failed")
                await TryNotifyTelegramAsync(rule, run, ct);

            return run;
        }
        finally
        {
            TenantAmbient.Set(prevTenant, prevSuper, prevResolved);
        }
    }

    private async Task TryNotifyTelegramAsync(AiAutomationRule rule, AiAutomationRun run, CancellationToken ct)
    {
        try
        {
            var settings = await db.AiSettings.FirstOrDefaultAsync(ct);
            if (settings is null || !settings.HasTelegramBotToken) return;

            var link = await db.TelegramLinks
                .FirstOrDefaultAsync(l => l.UserId == rule.RunAsUserId && l.IsLinked, ct);
            if (link?.TelegramChatId is not { } chatId) return;

            var botToken = protector.Unprotect(settings.ProtectedTelegramBotToken);
            if (string.IsNullOrEmpty(botToken)) return;

            var prefix = run.IsPending
                ? $"⏳ Automation \"{rule.Name}\" needs your approval:\n\n"
                : $"🤖 Automation \"{rule.Name}\":\n\n";
            var body = string.IsNullOrWhiteSpace(run.Summary) ? "(completed with no output)" : run.Summary!;
            var suffix = run.IsPending ? "\n\nOpen Vrodux → AI Assistant → Automations to approve." : "";

            await telegram.SendMessageAsync(botToken, chatId, prefix + body + suffix, ct);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Automation {Rule}: Telegram delivery failed", rule.Id);
        }
    }

    private string ResolveBaseUrl() =>
        configuration["Ai:BaseUrl"]
        ?? configuration["Integrations:PublicBaseUrl"]
        ?? "http://localhost:5000";
}
