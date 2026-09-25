using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Seo.Application.Content.Dtos;

namespace Softaxis.Seo.Application.Content.Commands;

public sealed record UpdateContentSettingsCommand(
    Guid SiteId, bool Enabled, string Frequency, int ArticlesPerRun, int TargetWordCount,
    string? NicheHint, string? CompetitorDomainsCsv) : ICommand<ContentSettingsDto>;

public sealed record GenerateArticleNowCommand(Guid SiteId) : ICommand<GenerateArticleNowResultDto>;
public sealed record ApproveArticleCommand(Guid Id) : ICommand<ArticleDto>;
public sealed record RejectArticleCommand(Guid Id) : ICommand<ArticleDto>;
/// <summary>Explicit, separate from Approve — approving is "this is good," pushing is "put it in
/// WordPress." A reviewer can approve now and push later once they've proofread it once more.</summary>
public sealed record PushArticleToWordPressCommand(Guid Id) : ICommand<ArticleDto>;

public sealed record ConnectWordPressCommand(Guid SiteId, string SiteUrl, string Username, string AppPassword) : ICommand<WordPressStatusDto>;

public sealed class ConnectWordPressValidator : AbstractValidator<ConnectWordPressCommand>
{
    public ConnectWordPressValidator()
    {
        RuleFor(x => x.SiteUrl).NotEmpty().WithMessage("The WordPress site URL is required.");
        RuleFor(x => x.Username).NotEmpty().WithMessage("The WordPress username is required.");
        RuleFor(x => x.AppPassword).NotEmpty().WithMessage("The application password is required.");
    }
}

public sealed record DisconnectWordPressCommand(Guid SiteId) : ICommand;
public sealed record SetWordPressAutoPublishCommand(Guid SiteId, bool AutoPublish) : ICommand<WordPressStatusDto>;
