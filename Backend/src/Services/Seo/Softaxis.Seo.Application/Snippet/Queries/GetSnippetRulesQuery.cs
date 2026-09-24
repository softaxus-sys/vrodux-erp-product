using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Seo.Application.Snippet.Dtos;

namespace Softaxis.Seo.Application.Snippet.Queries;

public sealed record GetSnippetRulesQuery(string SnippetKey, string? Path) : IQuery<IReadOnlyList<SnippetRuleDto>>;
