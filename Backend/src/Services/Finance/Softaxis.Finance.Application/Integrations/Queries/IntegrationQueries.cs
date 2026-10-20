using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Finance.Application.Integrations.Dtos;

namespace Softaxis.Finance.Application.Integrations.Queries;

/// <param name="Module">Limits the answer to one module's integrations (the module's own posting panel).</param>
public sealed record GetIntegrationOverviewQuery(string? Module = null, IReadOnlyList<string>? AllowedModules = null) : IQuery<IntegrationOverviewDto>;

public sealed record GetPostingItemsQuery(
    string? IntegrationKey, string? Status, string? Search, int Page = 1, int PageSize = 50,
    IReadOnlyList<string>? AllowedModules = null, string? Module = null)
    : IQuery<PostingItemPageDto>;

public sealed record GetPostingPreviewQuery(Guid Id) : IQuery<PostingPreviewDto>;

/// <summary>Checks a selection of queued documents without posting anything.</summary>
public sealed record CheckPostingItemsQuery(IReadOnlyList<Guid> Ids, PostingCaller? Caller = null) : IQuery<PostingCheckDto>;

/// <param name="StartDate">The start date about to be saved, when it differs from the stored one.</param>
public sealed record GetAutoReadinessQuery(string IntegrationKey, string? StartDate) : IQuery<AutoReadinessDto>;
