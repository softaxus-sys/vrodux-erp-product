using Softaxis.AiAssistant.Application.Abstractions;
using Softaxis.AiAssistant.Application.Chat.Commands;
using Softaxis.AiAssistant.Application.Chat.Dtos;
using Softaxis.AiAssistant.Infrastructure.Orchestration;
using Softaxis.AiAssistant.Infrastructure.Providers;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;

namespace Softaxis.AiAssistant.Infrastructure.Handlers.Chat;

internal sealed class ConfirmActionHandler(IAiOrchestrator orchestrator)
    : ICommandHandler<ConfirmActionCommand, AiChatResponseDto>
{
    public async Task<Result<AiChatResponseDto>> Handle(ConfirmActionCommand cmd, CancellationToken ct)
    {
        try
        {
            return await orchestrator.ConfirmAsync(cmd.ToolName, cmd.ArgumentsJson, ct);
        }
        catch (AiNotConfiguredException ex)
        {
            return new AiChatResponseDto(ex.Message, [], "none", "none");
        }
        catch (AiProviderException ex)
        {
            return new AiChatResponseDto(
                $"The action may have run, but I couldn't reach the AI provider to confirm it.\n\n> {ex.Message}",
                [], "none", "none");
        }
    }
}
