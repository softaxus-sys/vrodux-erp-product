using Softaxis.AiAssistant.Application.Voice.Dtos;
using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.AiAssistant.Application.Voice.Queries;

/// <summary>The current tenant's voice-agent settings (defaults when nothing is configured yet).</summary>
public sealed record GetVoiceSettingsQuery : IQuery<VoiceSettingsDto>;

/// <summary>The tenant's most recent scheduled/placed AI calls, newest first.</summary>
public sealed record GetScheduledCallsQuery(int Take = 50) : IQuery<IReadOnlyList<ScheduledCallDto>>;
