using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Softaxis.AiAssistant.Application.Abstractions;
using Softaxis.AiAssistant.Application.Voice.Commands;
using Softaxis.AiAssistant.Domain.Entities;
using Softaxis.AiAssistant.Infrastructure.Persistence;
using Softaxis.AiAssistant.Infrastructure.Tools;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.BuildingBlocks.Infrastructure.Persistence;
using Softaxis.Identity.Application.Auth.Commands.IssueServiceToken;

namespace Softaxis.AiAssistant.Infrastructure.Handlers.Voice;

/// <summary>
/// Processes one Vapi webhook delivery for a call the worker placed. Runs anonymously: the tenant
/// is resolved from the inbound key in the URL and the delivery authenticated against the tenant's
/// webhook secret, so every query here uses <c>IgnoreQueryFilters</c> plus an explicit tenant match
/// (the ambient tenant is unresolved — the global filter would silently return nothing).
/// Handles <c>status-update</c> (dialing → in_progress) and <c>end-of-call-report</c> (outcome,
/// transcript, recording, minutes usage, and the post-call CRM lead update as the run-as user).
/// </summary>
internal sealed class ProcessVapiEventHandler(
    AiAssistantDbContext db,
    ISender sender,
    GatewayToolClient gateway,
    IConfiguration config,
    ILogger<ProcessVapiEventHandler> logger) : ICommandHandler<ProcessVapiEventCommand>
{
    public async Task<Result> Handle(ProcessVapiEventCommand cmd, CancellationToken ct)
    {
        var settings = await db.VoiceSettings.IgnoreQueryFilters()
            .FirstOrDefaultAsync(x => x.InboundKey == cmd.InboundKey, ct);
        if (settings is null)
            return Result.Failure(Error.Custom("Voice.UnknownKey", "Unknown voice webhook key."));

        if (!SecretsMatch(settings.WebhookSecret, cmd.Secret))
        {
            logger.LogWarning("Voice webhook: secret mismatch for inbound key {Key}.", cmd.InboundKey);
            return Result.Failure(Error.Custom("Voice.BadSecret", "Webhook secret mismatch."));
        }

        var evt = ParseEvent(cmd.BodyJson);
        if (evt is null || string.IsNullOrEmpty(evt.CallId))
            return Result.Success(); // not a message shape we care about — ack and move on

        var tenantId = db.Entry(settings).Property<Guid?>(TenantIsolation.Column).CurrentValue;
        var call = await db.ScheduledCalls.IgnoreQueryFilters()
            .Include(x => x.Attempts)
            .Where(x => x.VapiCallId == evt.CallId)
            .Where(x => EF.Property<Guid?>(x, TenantIsolation.Column) == tenantId)
            .FirstOrDefaultAsync(ct);
        if (call is null)
        {
            logger.LogWarning("Voice webhook: no scheduled call for Vapi call {VapiId}.", evt.CallId);
            return Result.Success();
        }

        switch (evt.Type)
        {
            case "status-update":
                if (evt.Status == "in-progress" && call.Status == "dialing")
                {
                    call.MarkInProgress();
                    await db.SaveChangesAsync(ct);
                }
                break;

            case "end-of-call-report":
                await FinalizeCallAsync(call, settings, evt, ct);
                break;
        }

        return Result.Success();
    }

    private async Task FinalizeCallAsync(ScheduledCall call, TenantVoiceSettings settings, VapiEvent evt, CancellationToken ct)
    {
        // Vapi can re-deliver; only finalize a live call.
        if (call.Status is not ("dialing" or "in_progress"))
            return;

        var outcome = MapOutcome(evt.EndedReason);
        call.RecordOutcome(outcome, evt.EndedReason, evt.DurationSeconds,
            evt.Transcript, evt.RecordingUrl, evt.Summary);

        call.Attempts
            .FirstOrDefault(a => a.VapiCallId == evt.CallId && a.Outcome is null)
            ?.Complete(outcome, evt.DurationSeconds, outcome == "failed" ? evt.EndedReason : null);

        settings.AddMinutesUsed(evt.DurationSeconds / 60m, DateTime.UtcNow);

        // Simple retry (M2 refines to the 1h/4h ladder): an unanswered call goes back in the queue.
        if (outcome == "no_answer" && call.AttemptCount < settings.MaxAttempts)
            call.Reschedule(DateTime.UtcNow.AddHours(1));

        await db.SaveChangesAsync(ct);
        logger.LogInformation("Voice: call {Call} ended → {Outcome} ({Reason}, {Sec}s).",
            call.Id, outcome, evt.EndedReason, evt.DurationSeconds);

        if (outcome == "completed")
            await UpdateLeadAsync(call, settings, ct);
    }

    /// <summary>Marks the lead contacted and logs a call activity with the summary/recording —
    /// through the ERP's own API as the run-as user, so RBAC and tenant isolation bound the write.</summary>
    private async Task UpdateLeadAsync(ScheduledCall call, TenantVoiceSettings settings, CancellationToken ct)
    {
        try
        {
            var baseUrl = config["Ai:BaseUrl"] ?? config["Integrations:PublicBaseUrl"] ?? "http://localhost:5000";
            var tokenResult = await sender.Send(new IssueServiceTokenCommand(settings.RunAsUserId), ct);
            if (tokenResult.IsFailure)
            {
                logger.LogWarning("Voice: cannot update lead {Lead} — run-as user token refused: {Err}.",
                    call.LeadId, tokenResult.Error.Description);
                return;
            }
            var tok = tokenResult.Value;

            using (AiImpersonation.Use(new AiImpersonatedUser(
                tok.UserId, tok.Username, tok.Email, tok.IsSuperAdmin,
                tok.Permissions.ToHashSet(StringComparer.Ordinal), tok.AccessToken, baseUrl)))
            {
                await gateway.PatchAsync($"api/crm/leads/{call.LeadId}/status",
                    JsonSerializer.Serialize(new { status = "contacted" }), ct);

                var description = BuildActivityDescription(call);
                await gateway.PostAsync("api/crm/activities", JsonSerializer.Serialize(new
                {
                    type          = "call",
                    subject       = $"AI voice agent called {call.LeadName}",
                    description,
                    relatedToType = "lead",
                    relatedToId   = call.LeadId,
                    relatedToName = call.LeadName,
                    assignedTo    = tok.Username ?? "AI Voice Agent",
                }), ct);
            }

            call.MarkLeadUpdated();
            await db.SaveChangesAsync(ct);
        }
        catch (Exception ex)
        {
            // The call outcome is already stored — a CRM write failure must not fail the webhook.
            logger.LogWarning(ex, "Voice: post-call lead update failed for lead {Lead}.", call.LeadId);
        }
    }

    private static string BuildActivityDescription(ScheduledCall call)
    {
        var sb = new StringBuilder();
        sb.AppendLine($"Outcome: answered, {call.DurationSeconds}s.");
        if (!string.IsNullOrEmpty(call.Summary))
            sb.AppendLine().AppendLine("Summary:").AppendLine(call.Summary);
        if (!string.IsNullOrEmpty(call.RecordingUrl))
            sb.AppendLine().AppendLine($"Recording: {call.RecordingUrl}");
        var text = sb.ToString().Trim();
        return text.Length <= 3500 ? text : text[..3500];
    }

    private static string MapOutcome(string? endedReason)
    {
        var r = (endedReason ?? "").ToLowerInvariant();
        if (r.Contains("did-not-answer") || r.Contains("no-answer") || r.Contains("busy") || r.Contains("voicemail"))
            return "no_answer";
        if (r.Contains("error") || r.Contains("failed") || r.Contains("invalid") || r.Contains("rejected"))
            return "failed";
        return "completed";
    }

    private static bool SecretsMatch(string expected, string? provided)
    {
        if (string.IsNullOrEmpty(provided)) return false;
        var a = Encoding.UTF8.GetBytes(expected);
        var b = Encoding.UTF8.GetBytes(provided);
        return a.Length == b.Length && CryptographicOperations.FixedTimeEquals(a, b);
    }

    // ── Payload parsing ────────────────────────────────────────────────────────

    private sealed record VapiEvent(
        string Type, string? CallId, string? Status, string? EndedReason,
        int DurationSeconds, string? Transcript, string? RecordingUrl, string? Summary);

    /// <summary>Extracts the fields we use from Vapi's <c>{"message":{…}}</c> envelope. Tolerant of
    /// shape drift: every field is optional and looked up in both its artifact and legacy locations.</summary>
    private static VapiEvent? ParseEvent(string bodyJson)
    {
        try
        {
            using var doc = JsonDocument.Parse(bodyJson);
            if (!doc.RootElement.TryGetProperty("message", out var msg) || msg.ValueKind != JsonValueKind.Object)
                return null;

            var type = Str(msg, "type");
            if (type is null) return null;

            string? callId = null;
            if (msg.TryGetProperty("call", out var callEl) && callEl.ValueKind == JsonValueKind.Object)
                callId = Str(callEl, "id");

            string? transcript = null, recordingUrl = null;
            if (msg.TryGetProperty("artifact", out var art) && art.ValueKind == JsonValueKind.Object)
            {
                transcript   = Str(art, "transcript");
                recordingUrl = Str(art, "recordingUrl");
            }
            transcript   ??= Str(msg, "transcript");
            recordingUrl ??= Str(msg, "recordingUrl");

            string? summary = null;
            if (msg.TryGetProperty("analysis", out var an) && an.ValueKind == JsonValueKind.Object)
                summary = Str(an, "summary");
            summary ??= Str(msg, "summary");

            return new VapiEvent(
                type, callId, Str(msg, "status"), Str(msg, "endedReason"),
                Duration(msg), transcript, recordingUrl, summary);
        }
        catch
        {
            return null;
        }
    }

    private static int Duration(JsonElement msg)
    {
        if (msg.TryGetProperty("durationSeconds", out var s) && s.ValueKind == JsonValueKind.Number)
            return (int)Math.Round(s.GetDouble());
        if (msg.TryGetProperty("durationMs", out var ms) && ms.ValueKind == JsonValueKind.Number)
            return (int)Math.Round(ms.GetDouble() / 1000);
        // Fall back to endedAt - startedAt.
        var started = Str(msg, "startedAt");
        var ended   = Str(msg, "endedAt");
        if (started is not null && ended is not null &&
            DateTimeOffset.TryParse(started, out var st) && DateTimeOffset.TryParse(ended, out var en))
            return Math.Max(0, (int)(en - st).TotalSeconds);
        return 0;
    }

    private static string? Str(JsonElement el, string name) =>
        el.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;
}
