using FluentValidation;
using Softaxis.AiAssistant.Application.Chat.Dtos;
using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.AiAssistant.Application.Chat.Commands;

/// <summary>
/// Confirms and runs a previously-proposed write action (from a chat turn's PendingAction).
/// The tool still enforces the caller's tenant + permissions, so this can only do what the user
/// could do manually — the confirmation is a UX safety, not the security boundary.
/// </summary>
public sealed record ConfirmActionCommand(
    string ToolName,
    string ArgumentsJson) : ICommand<AiChatResponseDto>;

public sealed class ConfirmActionCommandValidator : AbstractValidator<ConfirmActionCommand>
{
    public ConfirmActionCommandValidator()
    {
        RuleFor(x => x.ToolName).NotEmpty().MaximumLength(100);
        RuleFor(x => x.ArgumentsJson).MaximumLength(8000);
    }
}
