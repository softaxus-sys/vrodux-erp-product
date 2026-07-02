namespace Softaxis.AiAssistant.Application.Abstractions;

/// <summary>Role of a message in an AI conversation.</summary>
public enum AiRole { System, User, Assistant, Tool }

/// <summary>
/// A single message in the conversation, normalised across providers. For an assistant
/// turn that requested tools, <see cref="ToolCalls"/> is populated; for a tool result,
/// <see cref="ToolCallId"/> ties the result back to the request.
/// </summary>
public sealed record AiChatMessage(
    AiRole Role,
    string? Content = null,
    IReadOnlyList<AiToolCall>? ToolCalls = null,
    string? ToolCallId = null);

/// <summary>A tool the model may call — provider-agnostic (JSON Schema for parameters).</summary>
public sealed record AiToolDefinition(
    string Name,
    string Description,
    string ParametersJsonSchema,
    bool IsReadOnly);

/// <summary>A tool invocation requested by the model.</summary>
public sealed record AiToolCall(
    string Id,
    string Name,
    string ArgumentsJson);

/// <summary>What the caller asks a provider to complete.</summary>
public sealed record AiCompletionRequest(
    string Model,
    string ApiKey,
    string SystemPrompt,
    IReadOnlyList<AiChatMessage> Messages,
    IReadOnlyList<AiToolDefinition> Tools);

/// <summary>Result of one provider round-trip.</summary>
public sealed record AiCompletionResult(
    string? AssistantText,
    IReadOnlyList<AiToolCall> ToolCalls)
{
    public bool WantsTools => ToolCalls.Count > 0;
}
