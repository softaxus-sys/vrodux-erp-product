using Softaxis.AiAssistant.Application.Abstractions;
using Softaxis.AiAssistant.Application.Chat.Commands;
using Softaxis.AiAssistant.Application.Chat.Dtos;
using Softaxis.AiAssistant.Infrastructure.Orchestration;
using Softaxis.AiAssistant.Infrastructure.Providers;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;

namespace Softaxis.AiAssistant.Infrastructure.Handlers.Chat;

internal sealed class SendChatMessageHandler(IAiOrchestrator orchestrator)
    : ICommandHandler<SendChatMessageCommand, AiChatResponseDto>
{
    public async Task<Result<AiChatResponseDto>> Handle(SendChatMessageCommand cmd, CancellationToken ct)
    {
        var history = MapHistory(cmd.History);

        try
        {
            var response = await orchestrator.RunAsync(cmd.Message, history, cmd.Agent, ct);
            return response;
        }
        // Not-configured / provider errors are surfaced as a normal assistant message so the user
        // gets actionable feedback in the chat rather than a raw error toast.
        catch (AiNotConfiguredException ex)
        {
            return new AiChatResponseDto(ex.Message, [], "none", "none");
        }
        catch (AiProviderException ex)
        {
            return new AiChatResponseDto(
                $"I couldn't reach the AI provider. Please check the API key and model in Settings.\n\n> {ex.Message}",
                [], "none", "none");
        }
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
