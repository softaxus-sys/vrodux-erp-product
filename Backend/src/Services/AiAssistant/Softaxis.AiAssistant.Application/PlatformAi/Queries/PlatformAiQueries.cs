using Softaxis.AiAssistant.Application.PlatformAi.Dtos;
using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.AiAssistant.Application.PlatformAi.Queries;

public sealed record GetPlatformAiQuery : IQuery<PlatformAiDto>;

/// <summary>Per-workspace use of the platform AI for one month (default: the current one), heaviest first.</summary>
public sealed record GetPlatformAiUsageQuery(string? Month) : IQuery<IReadOnlyList<PlatformAiUsageRowDto>>;
