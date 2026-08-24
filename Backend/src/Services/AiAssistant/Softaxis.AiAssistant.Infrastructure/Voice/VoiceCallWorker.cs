using System.Text.Json;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Softaxis.AiAssistant.Application.Abstractions;
using Softaxis.AiAssistant.Domain.Entities;
using Softaxis.AiAssistant.Infrastructure.Persistence;
using Softaxis.AiAssistant.Infrastructure.Tools;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.BuildingBlocks.Infrastructure.Persistence;
using Softaxis.Identity.Application.Auth.Commands.IssueServiceToken;

namespace Softaxis.AiAssistant.Infrastructure.Voice;

/// <summary>
/// Places due outbound calls (M1). Mirrors <c>AiAutomationScheduler</c>: scans pending
/// <see cref="ScheduledCall"/>s across all tenants, scopes the ambient tenant per call, re-checks
/// guardrails at dial time (enabled, configured, minutes cap, lead not already handled), and fires
/// the call via <see cref="VapiClient"/>. The lead check runs through the ERP's own API as the
/// tenant's run-as user, so tenant isolation and RBAC bound what the agent can see.
/// </summary>
public sealed class VoiceCallWorker(
    IServiceScopeFactory scopeFactory,
    ILogger<VoiceCallWorker> logger) : BackgroundService
{
    private const int BatchSize = 10;
    private static readonly TimeSpan Interval     = TimeSpan.FromSeconds(30);
    private static readonly TimeSpan StartupDelay = TimeSpan.FromSeconds(50);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try { await Task.Delay(StartupDelay, stoppingToken); } catch (OperationCanceledException) { return; }

        while (!stoppingToken.IsCancellationRequested)
        {
            try { await TickAsync(stoppingToken); }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "VoiceCallWorker: tick failed.");
            }

            try { await Task.Delay(Interval, stoppingToken); } catch (OperationCanceledException) { break; }
        }
    }

    private async Task TickAsync(CancellationToken ct)
    {
        List<DueRow> rows;
        using (var scope = scopeFactory.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AiAssistantDbContext>();
            var now = DateTime.UtcNow;
            rows = await db.ScheduledCalls.IgnoreQueryFilters()
                .Where(x => x.Status == "pending" && x.DueAt <= now)
                .OrderBy(x => x.DueAt)
                .Take(BatchSize)
                .Select(x => new DueRow(x.Id, EF.Property<Guid?>(x, TenantIsolation.Column)))
                .ToListAsync(ct);
        }

        foreach (var row in rows.Where(x => x.TenantId != null))
        {
            if (ct.IsCancellationRequested) break;
            var tenantId = row.TenantId!.Value;

            using var scope = scopeFactory.CreateScope();
            TenantAmbient.Set(tenantId, isSuperAdmin: false, isResolved: true);
            try
            {
                await PlaceCallAsync(scope.ServiceProvider, row.Id, ct);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "VoiceCallWorker: call {Call} failed.", row.Id);
                var db = scope.ServiceProvider.GetRequiredService<AiAssistantDbContext>();
                var call = await db.ScheduledCalls.FirstOrDefaultAsync(x => x.Id == row.Id, ct);
                if (call is not null && call.Status is "pending" or "dialing")
                {
                    call.Fail(ex.Message);
                    await db.SaveChangesAsync(ct);
                }
            }
            finally
            {
                TenantAmbient.Clear();
            }
        }
    }

    private async Task PlaceCallAsync(IServiceProvider sp, Guid callId, CancellationToken ct)
    {
        var db        = sp.GetRequiredService<AiAssistantDbContext>();
        var protector = sp.GetRequiredService<ISecretProtector>();
        var vapi      = sp.GetRequiredService<VapiClient>();
        var sender    = sp.GetRequiredService<ISender>();
        var config    = sp.GetRequiredService<IConfiguration>();

        var call = await db.ScheduledCalls.FirstOrDefaultAsync(x => x.Id == callId, ct);
        if (call is null || call.Status != "pending") return;

        var settings = await db.VoiceSettings.FirstOrDefaultAsync(ct);
        if (settings is null || !settings.Enabled || !settings.HasVapiApiKey ||
            string.IsNullOrEmpty(settings.VapiPhoneNumberId))
        {
            call.Cancel("Voice agent is disabled or not fully configured.");
            await db.SaveChangesAsync(ct);
            return;
        }

        var now = DateTime.UtcNow;
        if (settings.IsOverMinutesCap(now))
        {
            call.Cancel($"Monthly voice minutes cap reached ({settings.MonthlyMinutesCap} min).");
            await db.SaveChangesAsync(ct);
            return;
        }

        // Skip if a human already got to the lead — checked via the ERP API as the run-as user.
        var baseUrl = config["Ai:BaseUrl"] ?? config["Integrations:PublicBaseUrl"] ?? "http://localhost:5000";
        var tokenResult = await sender.Send(new IssueServiceTokenCommand(settings.RunAsUserId), ct);
        if (tokenResult.IsFailure)
        {
            call.Fail("The voice agent's run-as user is no longer eligible (locked, unverified, or deleted).");
            await db.SaveChangesAsync(ct);
            return;
        }
        var tok = tokenResult.Value;

        using (AiImpersonation.Use(new AiImpersonatedUser(
            tok.UserId, tok.Username, tok.Email, tok.IsSuperAdmin,
            tok.Permissions.ToHashSet(StringComparer.Ordinal), tok.AccessToken, baseUrl,
            tok.Modules.ToHashSet(StringComparer.OrdinalIgnoreCase))))
        {
            var gateway = sp.GetRequiredService<GatewayToolClient>();
            var leadStatus = await GetLeadStatusAsync(gateway, call.LeadId, ct);
            if (leadStatus is "deleted")
            {
                call.Cancel("Lead no longer exists.");
                await db.SaveChangesAsync(ct);
                return;
            }
            if (leadStatus is not null && leadStatus != "new")
            {
                call.Cancel($"Lead is already being handled (status: {leadStatus}).");
                await db.SaveChangesAsync(ct);
                return;
            }
        }

        // Cap the call length to whatever is left under the monthly cap (min 2 minutes to be useful).
        var maxSeconds = 600;
        if (settings.MonthlyMinutesCap > 0 && settings.UsageMonth == now.ToString("yyyy-MM"))
        {
            var remaining = (int)((settings.MonthlyMinutesCap - settings.MinutesUsedThisMonth) * 60);
            maxSeconds = Math.Max(120, Math.Min(maxSeconds, remaining));
        }

        var apiKey     = protector.Unprotect(settings.ProtectedVapiApiKey!);
        var publicBase = (config["Integrations:PublicBaseUrl"] ?? baseUrl).TrimEnd('/');
        var request = new VapiOutboundCallRequest(
            PhoneNumberId:      settings.VapiPhoneNumberId!,
            CustomerNumber:     call.Phone,
            CustomerName:       call.LeadName,
            SystemPrompt:       VoiceCallPromptBuilder.BuildSystemPrompt(settings, call),
            FirstMessage:       VoiceCallPromptBuilder.BuildFirstMessage(settings, call),
            ServerUrl:          $"{publicBase}/api/ai/voice/webhook/{settings.InboundKey}",
            ServerSecret:       settings.WebhookSecret,
            MaxDurationSeconds: maxSeconds,
            AssistantId:        settings.VapiAssistantId,
            Variables:          BuildVariables(settings, call));

        var vapiCall = await vapi.CreateOutboundCallAsync(apiKey!, request, ct);
        call.StartAttempt(vapiCall.Id);
        await db.SaveChangesAsync(ct);
        logger.LogInformation("Voice: call {Call} dialing lead {Lead} (Vapi {VapiId}).", call.Id, call.LeadId, vapiCall.Id);
    }

    /// <summary>Template values for a persistent (dashboard-built) assistant — usable in its prompt
    /// as <c>{{leadName}}</c>, <c>{{company}}</c> etc. The lead's own form fields win over persona defaults.</summary>
    private static Dictionary<string, string> BuildVariables(
        Domain.Entities.TenantVoiceSettings settings, Domain.Entities.ScheduledCall call)
    {
        var vars = new Dictionary<string, string>(StringComparer.Ordinal)
        {
            ["leadName"]    = call.LeadName,
            ["firstName"]   = call.LeadName.Split(' ', 2)[0],
            ["language"]    = call.Language,
            ["agentName"]   = settings.AgentName ?? "Alex",
            ["companyName"] = settings.CompanyName ?? "",
            ["industry"]    = settings.Industry ?? "",
        };

        if (!string.IsNullOrWhiteSpace(call.LeadContext))
        {
            try
            {
                using var doc = JsonDocument.Parse(call.LeadContext);
                foreach (var prop in doc.RootElement.EnumerateObject())
                {
                    if (prop.Value.ValueKind == JsonValueKind.String &&
                        !string.IsNullOrEmpty(prop.Value.GetString()))
                        vars[char.ToLowerInvariant(prop.Name[0]) + prop.Name[1..]] = prop.Value.GetString()!;
                }
            }
            catch
            {
                // Malformed context is prompt garnish, never a reason to skip the call.
            }
        }
        return vars;
    }

    /// <summary>Returns the lead's status, "deleted" on a 404, or null when the check couldn't run
    /// (transient API failure — the call proceeds rather than losing the follow-up window).</summary>
    private static async Task<string?> GetLeadStatusAsync(GatewayToolClient gateway, Guid leadId, CancellationToken ct)
    {
        try
        {
            var json = await gateway.GetAsync($"api/crm/leads/{leadId}", ct);
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            if (root.TryGetProperty("error", out var err))
                return err.GetString()?.Contains("404") == true ? "deleted" : null;
            return root.TryGetProperty("status", out var st) ? st.GetString() : null;
        }
        catch
        {
            return null;
        }
    }

    private sealed record DueRow(Guid Id, Guid? TenantId);
}
