using System.Text;
using System.Text.Json;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Softaxis.AiAssistant.Application.Abstractions;
using Softaxis.AiAssistant.Application.Telegram.Commands;
using Softaxis.AiAssistant.Domain.Enums;
using Softaxis.AiAssistant.Infrastructure.Persistence;
using Softaxis.AiAssistant.Infrastructure.Providers;
using Softaxis.AiAssistant.Infrastructure.Telegram;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Application.Auth.Commands.IssueServiceToken;
using Softaxis.Identity.Application.DTOs;

namespace Softaxis.AiAssistant.Infrastructure.Handlers.Telegram;

/// <summary>
/// Handles one inbound Telegram update. Resolves the tenant from the inbound key, then: completes a
/// "/start &lt;code&gt;" link; transcribes a voice note (Groq Whisper); answers the linked user as
/// themselves; and drives a text-based write confirm/reject flow (the bot shows what it will change,
/// the user replies "confirm"/"reject", and on confirm the write runs against the ERP).
/// </summary>
internal sealed class ProcessTelegramUpdateHandler(
    AiAssistantDbContext db,
    ISecretProtector protector,
    ISender sender,
    IAiOrchestrator orchestrator,
    TelegramClient telegram,
    GroqAudioTranscriber transcriber,
    ILogger<ProcessTelegramUpdateHandler> logger) : ICommandHandler<ProcessTelegramUpdateCommand>
{
    public async Task<Result> Handle(ProcessTelegramUpdateCommand cmd, CancellationToken ct)
    {
        var row = await db.AiSettings.IgnoreQueryFilters()
            .Where(s => s.TelegramInboundKey == cmd.InboundKey)
            .Select(s => new { Settings = s, TenantId = EF.Property<Guid?>(s, "TenantId") })
            .FirstOrDefaultAsync(ct);

        if (row is null || !row.Settings.HasTelegramBotToken || row.TenantId is null)
            return Result.Success();

        var tenantId = row.TenantId.Value;
        var settings = row.Settings;
        var botToken = protector.Unprotect(settings.ProtectedTelegramBotToken);
        if (string.IsNullOrEmpty(botToken)) return Result.Success();

        if (!TryParse(cmd.RawUpdateJson, out var chatId, out var text, out var fromUsername, out var voiceFileId))
            return Result.Success();

        // ── /start <code> → complete the link ────────────────────────────────
        if (text.StartsWith("/start", StringComparison.OrdinalIgnoreCase))
        {
            await HandleStartAsync(botToken, chatId, text, tenantId, ct);
            return Result.Success();
        }

        // ── Resolve the linked user for this chat ─────────────────────────────
        var lk = await db.TelegramLinks.IgnoreQueryFilters()
            .Where(l => l.TelegramChatId == chatId && l.IsLinked)
            .Select(l => new { Link = l, TenantId = EF.Property<Guid?>(l, "TenantId") })
            .FirstOrDefaultAsync(ct);

        if (lk is null || lk.TenantId != tenantId)
        {
            await telegram.SendMessageAsync(botToken, chatId,
                "This chat isn't linked to Vrodux. Open the app → AI Assistant → Connect Telegram.", ct);
            return Result.Success();
        }
        var link = lk.Link;

        // ── Voice note → transcribe via Groq Whisper ──────────────────────────
        if (voiceFileId is not null)
        {
            if (settings.Provider is not (AiProvider.GroqFree or AiProvider.GroqPaid))
            {
                await telegram.SendMessageAsync(botToken, chatId,
                    "Voice messages need a Groq API key for transcription. Please type your question, or switch the AI provider to Groq in Settings.", ct);
                return Result.Success();
            }
            var apiKey = protector.Unprotect(settings.ProtectedApiKey);
            if (string.IsNullOrEmpty(apiKey))
            {
                await telegram.SendMessageAsync(botToken, chatId, "No AI key is configured. Ask an administrator to add one.", ct);
                return Result.Success();
            }
            var file = await telegram.DownloadFileAsync(botToken, voiceFileId, ct);
            var transcript = file is null ? null : await transcriber.TranscribeAsync(apiKey, file.Value.Bytes, file.Value.FileName, ct);
            if (string.IsNullOrWhiteSpace(transcript))
            {
                await telegram.SendMessageAsync(botToken, chatId, "Sorry, I couldn't transcribe that voice note. Please try again or type your question.", ct);
                return Result.Success();
            }
            text = transcript.Trim();
            await telegram.SendMessageAsync(botToken, chatId, $"🎙 I heard: \"{text}\"", ct);
        }

        if (string.IsNullOrWhiteSpace(text)) return Result.Success();

        // Mint a token so tools (and any confirmed write) run as this user.
        var tokenResult = await sender.Send(new IssueServiceTokenCommand(link.UserId), ct);
        if (tokenResult.IsFailure)
        {
            await telegram.SendMessageAsync(botToken, chatId, "I couldn't verify your Vrodux account. Please re-connect in the app.", ct);
            return Result.Success();
        }
        var tok = tokenResult.Value;
        string reply;

        // ── Pending write awaiting confirm/reject? ────────────────────────────
        if (link.HasPending)
        {
            var decision = Classify(text);
            if (decision == Decision.Confirm)
            {
                reply = await RunScopedAsync(tenantId, tok, cmd.BaseUrl, async () =>
                {
                    var res = await orchestrator.ConfirmAsync(link.PendingToolName!, link.PendingArgumentsJson ?? "{}", ct);
                    return res.Reply;
                }, "the action");
                link.ClearPending();
                await db.SaveChangesAsync(ct);
                await telegram.SendMessageAsync(botToken, chatId, "✅ " + reply, ct);
                return Result.Success();
            }
            if (decision == Decision.Reject)
            {
                link.ClearPending();
                await db.SaveChangesAsync(ct);
                await telegram.SendMessageAsync(botToken, chatId, "Okay — cancelled. I won't make that change.", ct);
                return Result.Success();
            }
            // Neither confirm nor reject → treat as a new request; drop the stale pending action.
            link.ClearPending();
            await db.SaveChangesAsync(ct);
        }

        // ── Normal turn ───────────────────────────────────────────────────────
        AiAssistant.Application.Chat.Dtos.PendingActionDto? pending = null;
        reply = await RunScopedAsync(tenantId, tok, cmd.BaseUrl, async () =>
        {
            var res = await orchestrator.RunAsync(text, [], null, ct);
            pending = res.PendingAction;
            return res.Reply;
        }, "your request");

        if (pending is not null)
        {
            link.SetPending(pending.ToolName, pending.ArgumentsJson, reply);
            await db.SaveChangesAsync(ct);
            reply = $"{reply}\n\n{FormatPending(pending.ToolName, pending.ArgumentsJson)}\n\nReply \"confirm\" to proceed or \"reject\" to cancel.";
        }

        await telegram.SendMessageAsync(botToken, chatId, reply, ct);
        return Result.Success();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    /// <summary>Runs <paramref name="action"/> scoped to the tenant + impersonated user; returns a friendly message on failure.</summary>
    private async Task<string> RunScopedAsync(Guid tenantId, ServiceTokenDto tok, string baseUrl, Func<Task<string>> action, string what)
    {
        TenantAmbient.Set(tenantId, tok.IsSuperAdmin, isResolved: true);
        try
        {
            using (AiImpersonation.Use(new AiImpersonatedUser(
                tok.UserId, tok.Username, tok.Email, tok.IsSuperAdmin,
                tok.Permissions.ToHashSet(StringComparer.Ordinal), tok.AccessToken, baseUrl)))
            {
                return await action();
            }
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Telegram turn failed for tenant {Tenant}", tenantId);
            return FriendlyError(ex, what);
        }
        finally
        {
            TenantAmbient.Clear();
        }
    }

    private async Task HandleStartAsync(string botToken, long chatId, string text, Guid tenantId, CancellationToken ct)
    {
        var code = text.Length > 6 ? text[6..].Trim() : "";
        if (string.IsNullOrEmpty(code))
        {
            await telegram.SendMessageAsync(botToken, chatId,
                "Send /start with the link code from Vrodux → AI Assistant → Connect Telegram.", ct);
            return;
        }

        var linkRow = await db.TelegramLinks.IgnoreQueryFilters()
            .Where(l => l.LinkCode == code && !l.IsLinked)
            .Select(l => new { Link = l, TenantId = EF.Property<Guid?>(l, "TenantId") })
            .FirstOrDefaultAsync(ct);

        if (linkRow is null || linkRow.TenantId != tenantId)
        {
            await telegram.SendMessageAsync(botToken, chatId,
                "That link code is invalid or already used. Generate a new one in Vrodux.", ct);
            return;
        }

        linkRow.Link.CompleteLink(chatId, null);
        await db.SaveChangesAsync(ct);
        await telegram.SendMessageAsync(botToken, chatId,
            $"✅ Connected! You're linked to Vrodux as {linkRow.Link.UserName}. Ask me anything, or send a voice note.", ct);
    }

    private static string FriendlyError(Exception ex, string what)
    {
        var msg = ex.Message ?? "";
        if (msg.Contains("429") || msg.Contains("rate limit", StringComparison.OrdinalIgnoreCase) || msg.Contains("rate_limit", StringComparison.OrdinalIgnoreCase))
            return "I'm being rate-limited by the AI provider right now. Please wait ~20 seconds and try again (or switch to Claude in Settings for higher limits).";
        if (msg.Contains("api key", StringComparison.OrdinalIgnoreCase) || msg.Contains("401") || msg.Contains("invalid_api_key", StringComparison.OrdinalIgnoreCase))
            return "The AI provider rejected the request — please check the API key and model in Settings.";
        if (msg.Contains("not enabled", StringComparison.OrdinalIgnoreCase) || msg.Contains("not configured", StringComparison.OrdinalIgnoreCase))
            return msg;
        return $"Sorry, I hit an error handling {what}. Please try again in a moment.";
    }

    private enum Decision { Confirm, Reject, Other }

    private static Decision Classify(string text)
    {
        var t = text.Trim().ToLowerInvariant().TrimEnd('.', '!', '?', ' ');
        if (t is "confirm" or "yes" or "y" or "yep" or "yeah" or "ok" or "okay" or "approve" or "approved"
              or "proceed" or "do it" or "confirmed" or "go ahead" or "sure")
            return Decision.Confirm;
        if (t is "reject" or "no" or "n" or "nope" or "cancel" or "stop" or "don't" or "dont" or "abort" or "discard")
            return Decision.Reject;
        return Decision.Other;
    }

    private static string FormatPending(string toolName, string argumentsJson)
    {
        var sb = new StringBuilder();
        sb.Append("⚠️ I'm about to ").Append(Prettify(toolName)).Append(" with:");
        try
        {
            using var doc = JsonDocument.Parse(string.IsNullOrWhiteSpace(argumentsJson) ? "{}" : argumentsJson);
            foreach (var p in doc.RootElement.EnumerateObject())
            {
                var val = p.Value.ValueKind switch
                {
                    JsonValueKind.String => p.Value.GetString(),
                    JsonValueKind.Number => p.Value.ToString(),
                    JsonValueKind.True   => "yes",
                    JsonValueKind.False  => "no",
                    JsonValueKind.Null   => null,
                    _                    => p.Value.ToString(),
                };
                if (!string.IsNullOrWhiteSpace(val))
                    sb.Append("\n• ").Append(Prettify(p.Name)).Append(": ").Append(val);
            }
        }
        catch { /* show just the header if args aren't parseable */ }
        return sb.ToString();
    }

    /// <summary>"crm_create_lead" → "Crm create lead"; "firstName" → "First name".</summary>
    private static string Prettify(string raw)
    {
        if (string.IsNullOrEmpty(raw)) return raw;
        var sb = new StringBuilder();
        foreach (var ch in raw)
        {
            if (ch == '_') { if (sb.Length > 0 && sb[^1] != ' ') sb.Append(' '); }
            else if (char.IsUpper(ch) && sb.Length > 0 && sb[^1] != ' ') sb.Append(' ').Append(char.ToLowerInvariant(ch));
            else sb.Append(ch);
        }
        var s = sb.ToString().Trim();
        return s.Length == 0 ? raw : char.ToUpperInvariant(s[0]) + s[1..];
    }

    private static bool TryParse(string json, out long chatId, out string text, out string? fromUsername, out string? voiceFileId)
    {
        chatId = 0; text = ""; fromUsername = null; voiceFileId = null;
        try
        {
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            if (!root.TryGetProperty("message", out var msg)) return false;

            chatId = msg.GetProperty("chat").GetProperty("id").GetInt64();
            if (msg.TryGetProperty("from", out var from) && from.TryGetProperty("username", out var un))
                fromUsername = un.GetString();

            if (msg.TryGetProperty("text", out var t) && t.ValueKind == JsonValueKind.String)
                text = t.GetString() ?? "";

            // Voice note (or an audio file) → capture its file_id for transcription.
            if (msg.TryGetProperty("voice", out var voice) && voice.TryGetProperty("file_id", out var vf))
                voiceFileId = vf.GetString();
            else if (msg.TryGetProperty("audio", out var audio) && audio.TryGetProperty("file_id", out var af))
                voiceFileId = af.GetString();

            return !string.IsNullOrWhiteSpace(text) || voiceFileId is not null;
        }
        catch { return false; }
    }
}
