using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.Seo.Application.Snippet.Commands;

public sealed record PingSnippetCommand(string SnippetKey) : ICommand;
