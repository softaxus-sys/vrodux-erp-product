using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Seo.Application.Abstractions;
using Softaxis.Seo.Application.Content.Commands;
using Softaxis.Seo.Application.Content.Dtos;
using Softaxis.Seo.Application.Content.Queries;
using Softaxis.Seo.Domain.Entities;
using Softaxis.Seo.Infrastructure.Content;
using Softaxis.Seo.Infrastructure.Persistence;
using Softaxis.Seo.Infrastructure.WordPress;

namespace Softaxis.Seo.Infrastructure.Handlers.Content;

internal sealed class GetArticlesHandler(SeoDbContext db) : IQueryHandler<GetArticlesQuery, IReadOnlyList<ArticleDto>>
{
    public async Task<Result<IReadOnlyList<ArticleDto>>> Handle(GetArticlesQuery query, CancellationToken ct)
    {
        var q = db.Articles.Where(a => a.SiteId == query.SiteId);
        if (!string.IsNullOrWhiteSpace(query.Status)) q = q.Where(a => a.Status == query.Status);
        var articles = await q.OrderByDescending(a => a.CreatedAt).Take(200).ToListAsync(ct);
        return Result.Success<IReadOnlyList<ArticleDto>>(articles.Select(a => a.ToDto()).ToList());
    }
}

internal sealed class GetArticleByIdHandler(SeoDbContext db) : IQueryHandler<GetArticleByIdQuery, ArticleDto>
{
    public async Task<Result<ArticleDto>> Handle(GetArticleByIdQuery query, CancellationToken ct)
    {
        var article = await db.Articles.FirstOrDefaultAsync(a => a.Id == query.Id, ct);
        return article is null
            ? Result.Failure<ArticleDto>(Error.NotFoundById("SeoArticle", query.Id))
            : Result.Success(article.ToDto());
    }
}

internal sealed class GenerateArticleNowHandler(SeoDbContext db, IArticleGenerationRunner runner)
    : ICommandHandler<GenerateArticleNowCommand, GenerateArticleNowResultDto>
{
    public async Task<Result<GenerateArticleNowResultDto>> Handle(GenerateArticleNowCommand cmd, CancellationToken ct)
    {
        var site = await db.Sites.FirstOrDefaultAsync(s => s.Id == cmd.SiteId, ct);
        if (site is null) return Result.Failure<GenerateArticleNowResultDto>(Error.NotFoundById("SeoSite", cmd.SiteId));

        var settings = await db.ContentSettings.FirstOrDefaultAsync(cs => cs.SiteId == cmd.SiteId, ct);
        if (settings is null)
        {
            settings = new SeoContentSettings(cmd.SiteId);
            db.ContentSettings.Add(settings);
        }

        var count = await runner.RunAsync(site, settings, ct);
        settings.RecordRunCompleted(DateTime.UtcNow);
        await db.SaveChangesAsync(ct);

        return Result.Success(new GenerateArticleNowResultDto(count));
    }
}

internal sealed class ApproveArticleHandler(SeoDbContext db, ICurrentUser currentUser) : ICommandHandler<ApproveArticleCommand, ArticleDto>
{
    public async Task<Result<ArticleDto>> Handle(ApproveArticleCommand cmd, CancellationToken ct)
    {
        if (currentUser.Id is null)
            return Result.Failure<ArticleDto>(Error.Custom("Seo.Unresolved", "Could not resolve the signed-in user."));

        var article = await db.Articles.FirstOrDefaultAsync(a => a.Id == cmd.Id, ct);
        if (article is null) return Result.Failure<ArticleDto>(Error.NotFoundById("SeoArticle", cmd.Id));

        article.Approve(currentUser.Id.Value, currentUser.Username ?? "Unknown user");
        await db.SaveChangesAsync(ct);

        return Result.Success(article.ToDto());
    }
}

internal sealed class RejectArticleHandler(SeoDbContext db, ICurrentUser currentUser) : ICommandHandler<RejectArticleCommand, ArticleDto>
{
    public async Task<Result<ArticleDto>> Handle(RejectArticleCommand cmd, CancellationToken ct)
    {
        if (currentUser.Id is null)
            return Result.Failure<ArticleDto>(Error.Custom("Seo.Unresolved", "Could not resolve the signed-in user."));

        var article = await db.Articles.FirstOrDefaultAsync(a => a.Id == cmd.Id, ct);
        if (article is null) return Result.Failure<ArticleDto>(Error.NotFoundById("SeoArticle", cmd.Id));

        article.Reject(currentUser.Id.Value, currentUser.Username ?? "Unknown user");
        await db.SaveChangesAsync(ct);

        return Result.Success(article.ToDto());
    }
}

/// <summary>Explicit, separate action from Approve (see PushArticleToWordPressCommand's own remarks).
/// Refuses on an article that was never approved — pushing must never be the first thing that happens
/// to an AI draft.</summary>
internal sealed class PushArticleToWordPressHandler(SeoDbContext db, ISecretProtector protector, WordPressClient wp)
    : ICommandHandler<PushArticleToWordPressCommand, ArticleDto>
{
    public async Task<Result<ArticleDto>> Handle(PushArticleToWordPressCommand cmd, CancellationToken ct)
    {
        var article = await db.Articles.FirstOrDefaultAsync(a => a.Id == cmd.Id, ct);
        if (article is null) return Result.Failure<ArticleDto>(Error.NotFoundById("SeoArticle", cmd.Id));
        if (article.Status != "approved")
            return Result.Failure<ArticleDto>(Error.Custom("Seo.Article.Conflict", "Approve the article before pushing it to WordPress."));

        var connection = await db.WordPressConnections.FirstOrDefaultAsync(c => c.SiteId == article.SiteId, ct);
        if (connection is null)
            return Result.Failure<ArticleDto>(Error.Custom("Seo.WordPress.Conflict", "This site has no WordPress connection."));

        var appPassword = protector.Unprotect(connection.AppPassword)!;
        try
        {
            var status = connection.AutoPublish ? "publish" : "draft";
            var bodyHtml = Markdig.Markdown.ToHtml(article.BodyMarkdown);
            var postId = await wp.CreatePostAsync(connection.SiteUrl, connection.Username, appPassword, article.Title, bodyHtml, status, ct);
            article.RecordWordPressPush(postId);
            connection.RecordHealthy();
        }
        catch (Exception ex)
        {
            connection.RecordError(ex.Message);
            await db.SaveChangesAsync(ct);
            return Result.Failure<ArticleDto>(Error.Custom("Seo.WordPressPushFailed", ex.Message));
        }

        await db.SaveChangesAsync(ct);
        return Result.Success(article.ToDto());
    }
}
