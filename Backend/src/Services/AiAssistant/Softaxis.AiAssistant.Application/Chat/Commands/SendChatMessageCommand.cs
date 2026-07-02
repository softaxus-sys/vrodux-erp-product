using FluentValidation;
using Softaxis.AiAssistant.Application.Chat.Dtos;
using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.AiAssistant.Application.Chat.Commands;

/// <summary>One prior turn in the conversation, echoed back by the client for context.</summary>
public sealed record ChatHistoryItem(string Role, string Content);

/// <summary>
/// Sends a user message to the assistant. <see cref="Agent"/> optionally targets a named agent
/// (e.g. "crm") — when null the orchestrator auto-selects. Modelled as a command because a turn
/// may invoke tools that mutate state.
/// </summary>
public sealed record SendChatMessageCommand(
    string Message,
    IReadOnlyList<ChatHistoryItem>? History,
    string? Agent) : ICommand<AiChatResponseDto>;

public sealed class SendChatMessageCommandValidator : AbstractValidator<SendChatMessageCommand>
{
    public SendChatMessageCommandValidator()
    {
        RuleFor(x => x.Message).NotEmpty().MaximumLength(8000);
        RuleForEach(x => x.History).ChildRules(h =>
        {
            h.RuleFor(i => i.Role).NotEmpty();
            h.RuleFor(i => i.Content).MaximumLength(20000);
        });
    }
}
