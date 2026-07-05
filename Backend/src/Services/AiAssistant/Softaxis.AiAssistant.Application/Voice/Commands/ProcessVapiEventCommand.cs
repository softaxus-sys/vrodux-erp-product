using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.AiAssistant.Application.Voice.Commands;

/// <summary>
/// Processes one inbound Vapi webhook delivery (status updates and the end-of-call report).
/// The tenant is resolved from <paramref name="InboundKey"/> and the delivery is authenticated by
/// comparing <paramref name="Secret"/> (the <c>x-vapi-secret</c> header) to the tenant's stored secret.
/// </summary>
public sealed record ProcessVapiEventCommand(
    string InboundKey,
    string? Secret,
    string BodyJson) : ICommand;
