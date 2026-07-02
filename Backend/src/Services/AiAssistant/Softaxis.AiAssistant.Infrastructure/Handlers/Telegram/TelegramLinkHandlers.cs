using Microsoft.EntityFrameworkCore;
using Softaxis.AiAssistant.Application.Abstractions;
using Softaxis.AiAssistant.Application.Telegram.Commands;
using Softaxis.AiAssistant.Application.Telegram.Dtos;
using Softaxis.AiAssistant.Application.Telegram.Queries;
using Softaxis.AiAssistant.Domain.Entities;
using Softaxis.AiAssistant.Infrastructure.Persistence;
using Softaxis.AiAssistant.Infrastructure.Telegram;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;

namespace Softaxis.AiAssistant.Infrastructure.Handlers.Telegram;

internal static class TelegramLinkHelpers
{
    public static TelegramLinkStatusDto BuildStatus(TenantAiSettings? settings, UserTelegramLink? link)
    {
        var botConfigured = settings is { TelegramEnabled: true } && settings.HasTelegramBotToken;
        var pendingCode   = link is { IsLinked: false } ? link.LinkCode : null;
        var deepLink = botConfigured && pendingCode is not null && !string.IsNullOrEmpty(settings!.TelegramBotUsername)
            ? $"https://t.me/{settings.TelegramBotUsername}?start={pendingCode}"
            : null;

        return new TelegramLinkStatusDto(
            botConfigured,
            link?.IsLinked ?? false,
            link?.TelegramUsername,
            pendingCode,
            deepLink);
    }

    public static string NewCode() => Guid.NewGuid().ToString("N")[..10];
}

internal sealed class GetTelegramLinkStatusHandler(AiAssistantDbContext db, ICurrentUser currentUser)
    : IQueryHandler<GetTelegramLinkStatusQuery, TelegramLinkStatusDto>
{
    public async Task<Result<TelegramLinkStatusDto>> Handle(GetTelegramLinkStatusQuery request, CancellationToken ct)
    {
        var settings = await db.AiSettings.AsNoTracking().FirstOrDefaultAsync(ct);
        var userId   = currentUser.Id;
        var link = userId is null ? null
            : await db.TelegramLinks.AsNoTracking().FirstOrDefaultAsync(l => l.UserId == userId, ct);
        return TelegramLinkHelpers.BuildStatus(settings, link);
    }
}

internal sealed class GenerateTelegramLinkHandler(AiAssistantDbContext db, ICurrentUser currentUser)
    : ICommandHandler<GenerateTelegramLinkCommand, TelegramLinkStatusDto>
{
    public async Task<Result<TelegramLinkStatusDto>> Handle(GenerateTelegramLinkCommand cmd, CancellationToken ct)
    {
        var userId = currentUser.Id;
        if (userId is null)
            return Result.Failure<TelegramLinkStatusDto>(Error.Custom("Telegram.NoUser", "No authenticated user."));

        var link = await db.TelegramLinks.FirstOrDefaultAsync(l => l.UserId == userId, ct);
        var code = TelegramLinkHelpers.NewCode();

        if (link is null)
        {
            link = new UserTelegramLink(userId.Value, currentUser.Username ?? currentUser.Email ?? "user", code);
            db.TelegramLinks.Add(link);
        }
        else
        {
            link.ResetCode(code);
        }

        await db.SaveChangesAsync(ct);

        var settings = await db.AiSettings.AsNoTracking().FirstOrDefaultAsync(ct);
        return TelegramLinkHelpers.BuildStatus(settings, link);
    }
}

internal sealed class UnlinkTelegramHandler(AiAssistantDbContext db, ICurrentUser currentUser)
    : ICommandHandler<UnlinkTelegramCommand>
{
    public async Task<Result> Handle(UnlinkTelegramCommand cmd, CancellationToken ct)
    {
        var userId = currentUser.Id;
        if (userId is null) return Result.Success();

        var link = await db.TelegramLinks.FirstOrDefaultAsync(l => l.UserId == userId, ct);
        if (link is not null)
        {
            link.Unlink();
            await db.SaveChangesAsync(ct);
        }
        return Result.Success();
    }
}

internal sealed class RegisterTelegramWebhookHandler(
    AiAssistantDbContext db, ISecretProtector protector, ICurrentUser currentUser, TelegramClient telegram)
    : ICommandHandler<RegisterTelegramWebhookCommand, string>
{
    public async Task<Result<string>> Handle(RegisterTelegramWebhookCommand cmd, CancellationToken ct)
    {
        var settings = await db.AiSettings.FirstOrDefaultAsync(ct);
        if (settings is null || !settings.HasTelegramBotToken || string.IsNullOrEmpty(settings.TelegramInboundKey))
            return Result.Failure<string>(Error.Custom("Telegram.NotConfigured", "Save a Telegram bot token first."));

        var botToken = protector.Unprotect(settings.ProtectedTelegramBotToken);
        if (string.IsNullOrEmpty(botToken))
            return Result.Failure<string>(Error.Custom("Telegram.NotConfigured", "The bot token could not be read."));

        var baseUrl = (currentUser.RequestBaseUrl ?? "").TrimEnd('/');
        var webhookUrl = $"{baseUrl}/api/ai/telegram/webhook/{settings.TelegramInboundKey}";

        var (ok, desc) = await telegram.SetWebhookAsync(botToken, webhookUrl, ct);
        return ok
            ? webhookUrl
            : Result.Failure<string>(Error.Custom("Telegram.WebhookFailed", $"Telegram rejected the webhook: {desc}"));
    }
}
