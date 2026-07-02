using Softaxis.AiAssistant.Application.AiSettings.Dtos;
using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.AiAssistant.Application.AiSettings.Queries;

/// <summary>
/// The current tenant's AI capabilities (tier flags + which features are enabled). Available to any
/// authenticated user — carries no secrets — so non-admin UI can gate voice/automations/etc.
/// </summary>
public sealed record GetAiCapabilitiesQuery : IQuery<AiCapabilitiesDto>;
