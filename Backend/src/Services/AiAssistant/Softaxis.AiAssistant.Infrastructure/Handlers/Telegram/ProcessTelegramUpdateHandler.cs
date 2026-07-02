using System.Text.Json;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Softaxis.AiAssistant.Application.Abstractions;
using Softaxis.AiAssistant.Application.Telegram.Commands;
using Softaxis.AiAssistant.Infrastructure.Persistence;
using Softaxis.AiAssistant.Infrastructure.Telegram;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Multitenancy;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Identity.Application.Auth.Commands.IssueServiceToken;

namespace Softaxis.AiAssistant.Infrastructure.Handlers.Telegram;

/// <summary>
/// Handles one inbound Telegram update from the anonymous webhook. Resolves the tenant from the
/// inbound key (query filters bypassed — no ambient tenant on an anonymous request), then either
/// completes a "/start &lt;code&gt;" link or answers the linked user's message by minting a token for
/// them and running the orchestrator under their identity (tenant + permissions enforced).
/// </summary>
internal sealed class ProcessTelegramUpdateHandler(
    AiAssistantDbContext db,
    ISecretProtector protector,
    ISender sender,
    IAiOrchestrator orchestrator,
    TelegramClient telegram,
    ILogger<ProcessTelegramUpdateHandler> logger) : ICommandHandler<ProcessTelegramUpdateCommand>
{
    public async Task<Result> Handle(ProcessTelegramUpdateCommand cmd, CancellationToken ct)
    {
        // Resolve the tenant (+ its bot) from the inbound key. Query filters bypassed on purpose.
        var row = await db.AiSettings.IgnoreQueryFilters()
            .Where(s => s.TelegramInboundKey == cmd.InboundKey)
            .Select(s => new { Settings = s, TenantId = EF.Property<Guid?>(s, "TenantId") })
            .FirstOrDefaultAsync(ct);

        if (row is null || !row.Settings.HasTelegramBotToken || row.TenantId is null)
            return Result.Success(); // unknown key / no bot — ignore silently

        var tenantId = row.TenantId.Value;
        var botToken = protector.Unprotect(row.Settings.ProtectedTelegramBotToken);
        if (string.IsNullOrEmpty(botToken)) return Result.Success();

        if (!TryParse(cmd.RawUpdateJson, out var chatId, out var text, out var fromUsername))
            return Result.Success();

        // ── /start <code> → complete the link ────────────────────────────────
        if (text.StartsWith("/start", StringComparison.OrdinalIgnoreCase))
        {
            var code = text.Length > 6 ? text[6..].Trim() : "";
            if (string.IsNullOrEmpty(code))
            {
                await telegram.SendMessageAsync(botToken, chatId,
                    "Send /start with the link code from Vrodux → AI Assistant → Connect Telegram.", ct);
                return Result.Success();
            }

            var linkRow = await db.TelegramLinks.IgnoreQueryFilters()
                .Where(l => l.LinkCode == code && !l.IsLinked)
                .Select(l => new { Link = l, TenantId = EF.Property<Guid?>(l, "TenantId") })
                .FirstOrDefaultAsync(ct);

            if (linkRow is null || linkRow.TenantId != tenantId)
            {
                await telegram.SendMessageAsync(botToken, chatId,
                    "That link code is invalid or already used. Generate a new one in Vrodux.", ct);
                return Result.Success();
            }

            linkRow.Link.CompleteLink(chatId, fromUsername);
            await db.SaveChangesAsync(ct);
            await telegram.SendMessageAsync(botToken, chatId,
                $"✅ Connected! You're linked to Vrodux as {linkRow.Link.UserName}. Ask me anything about your business data.", ct);
            return Result.Success();
        }

        // ── Regular message → answer as the linked user ──────────────────────
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

        var tokenResult = await sender.Send(new IssueServiceTokenCommand(lk.Link.UserId), ct);
        if (tokenResult.IsFailure)
        {
            await telegram.SendMessageAsync(botToken, chatId,
                "I couldn't verify your Vrodux account. Please re-connect in the app.", ct);
            return Result.Success();
        }
        var tok = tokenResult.Value;

        string reply;
        TenantAmbient.Set(tenantId, tok.IsSuperAdmin, isResolved: true);
        try
        {
            using (AiImpersonation.Use(new AiImpersonatedUser(
                tok.UserId, tok.Username, tok.Email, tok.IsSuperAdmin,
                tok.Permissions.ToHashSet(StringComparer.Ordinal), tok.AccessToken, cmd.BaseUrl)))
            {
                var res = await orchestrator.RunAsync(text, [], null, ct);
                reply = res.Reply;
                if (res.PendingAction is not null)
                    reply += "\n\n(To make changes, please use the Vrodux app — write actions need confirmation there.)";
            }
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Telegram answer failed for tenant {Tenant}", tenantId);
            reply = "Sorry, I hit an error answering that. Please try again.";
        }
        finally
        {
            TenantAmbient.Clear();
        }

        await telegram.SendMessageAsync(botToken, chatId, reply, ct);
        return Result.Success();
    }

    private static bool TryParse(string json, out long chatId, out string text, out string? fromUsername)
    {
        chatId = 0; text = ""; fromUsername = null;
        try
        {
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            if (!root.TryGetProperty("message", out var msg)) return false;
            if (!msg.TryGetProperty("text", out var t) || t.ValueKind != JsonValueKind.String) return false;
            text = t.GetString() ?? "";
            chatId = msg.GetProperty("chat").GetProperty("id").GetInt64();
            if (msg.TryGetProperty("from", out var from) && from.TryGetProperty("username", out var un))
                fromUsername = un.GetString();
            return !string.IsNullOrWhiteSpace(text);
        }
        catch { return false; }
    }
}
