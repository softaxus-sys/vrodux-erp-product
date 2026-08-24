using Microsoft.EntityFrameworkCore;
using Softaxis.AiAssistant.Application.Abstractions;
using Softaxis.AiAssistant.Application.Chat.Commands;
using Softaxis.AiAssistant.Application.Chat.Dtos;
using Softaxis.AiAssistant.Domain.Entities;
using Softaxis.AiAssistant.Infrastructure.Orchestration;
using Softaxis.AiAssistant.Infrastructure.Persistence;
using Softaxis.AiAssistant.Infrastructure.Providers;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;

namespace Softaxis.AiAssistant.Infrastructure.Handlers.Chat;

internal sealed class SendChatMessageHandler(
    IAiOrchestrator orchestrator, AiAssistantDbContext db, ICurrentUser currentUser)
    : ICommandHandler<SendChatMessageCommand, AiChatResponseDto>
{
    public async Task<Result<AiChatResponseDto>> Handle(SendChatMessageCommand cmd, CancellationToken ct)
    {
        var history = MapHistory(cmd.History);

        AiChatResponseDto response;
        try
        {
            response = await orchestrator.RunAsync(cmd.Message, history, cmd.Agent, ct);
        }
        // Not-configured / provider errors are surfaced as a normal assistant message so the user
        // gets actionable feedback in the chat rather than a raw error toast.
        catch (AiNotConfiguredException ex)
        {
            response = new AiChatResponseDto(ex.Message, [], "none", "none");
        }
        catch (AiProviderException ex)
        {
            response = new AiChatResponseDto(
                $"I couldn't reach the AI provider. Please check the API key and model in Settings.\n\n> {ex.Message}",
                [], "none", "none");
        }

        await PersistTurnAsync(cmd.Message, response.Reply, response.UsedFallback, ct);
        return response;
    }

    /// <summary>
    /// Appends this turn to the caller's one ongoing conversation, so it survives navigation and
    /// logout/login. Best-effort: a user with no resolvable id (shouldn't happen behind
    /// [Authorize]) just doesn't get history persisted rather than failing the chat turn.
    /// </summary>
    private async Task PersistTurnAsync(string userMessage, string assistantReply, bool usedFallback, CancellationToken ct)
    {
        var userId = currentUser.Id;
        if (userId is null) return;

        var convo = await db.Conversations
            .Include(c => c.Messages)
            .Where(c => c.UserId == userId.Value)
            .OrderByDescending(c => c.UpdatedAt)
            .FirstOrDefaultAsync(ct);

        if (convo is null)
        {
            convo = new AiConversation(userId.Value);
            db.Conversations.Add(convo);
        }

        convo.Messages.Add(new AiConversationMessage(convo.Id, "user", userMessage));
        convo.Messages.Add(new AiConversationMessage(convo.Id, "assistant", assistantReply, usedFallback));
        convo.Touch();

        await db.SaveChangesAsync(ct);
    }

    private static List<AiChatMessage> MapHistory(IReadOnlyList<ChatHistoryItem>? history)
    {
        var mapped = new List<AiChatMessage>();
        if (history is null) return mapped;

        foreach (var item in history)
        {
            var role = item.Role?.Trim().ToLowerInvariant() switch
            {
                "assistant" => AiRole.Assistant,
                "user"      => AiRole.User,
                _           => (AiRole?)null,
            };
            if (role is null || string.IsNullOrWhiteSpace(item.Content)) continue;
            mapped.Add(new AiChatMessage(role.Value, item.Content));
        }
        return mapped;
    }
}
