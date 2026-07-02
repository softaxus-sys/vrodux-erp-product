using Softaxis.AiAssistant.Application.AiSettings.Dtos;
using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.AiAssistant.Application.AiSettings.Queries;

/// <summary>Returns the current tenant's AI settings (creating defaults if none exist yet).</summary>
public sealed record GetAiSettingsQuery : IQuery<AiSettingsDto>;
