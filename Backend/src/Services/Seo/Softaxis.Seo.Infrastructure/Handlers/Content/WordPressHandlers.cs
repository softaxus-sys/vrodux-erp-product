using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Seo.Application.Abstractions;
using Softaxis.Seo.Application.Content.Commands;
using Softaxis.Seo.Application.Content.Dtos;
using Softaxis.Seo.Application.Content.Queries;
using Softaxis.Seo.Domain.Entities;
using Softaxis.Seo.Infrastructure.Persistence;
using Softaxis.Seo.Infrastructure.WordPress;

namespace Softaxis.Seo.Infrastructure.Handlers.Content;

internal sealed class GetWordPressStatusHandler(SeoDbContext db) : IQueryHandler<GetWordPressStatusQuery, WordPressStatusDto>
{
    public async Task<Result<WordPressStatusDto>> Handle(GetWordPressStatusQuery query, CancellationToken ct)
    {
        var connection = await db.WordPressConnections.FirstOrDefaultAsync(c => c.SiteId == query.SiteId, ct);
        return Result.Success(connection.ToDto());
    }
}

internal sealed class ConnectWordPressHandler(SeoDbContext db, ISecretProtector protector, WordPressClient wp)
    : ICommandHandler<ConnectWordPressCommand, WordPressStatusDto>
{
    public async Task<Result<WordPressStatusDto>> Handle(ConnectWordPressCommand cmd, CancellationToken ct)
    {
        var site = await db.Sites.FirstOrDefaultAsync(s => s.Id == cmd.SiteId, ct);
        if (site is null) return Result.Failure<WordPressStatusDto>(Error.NotFoundById("SeoSite", cmd.SiteId));

        var siteUrl = NormalizeUrl(cmd.SiteUrl);

        // Prove the credentials actually work before storing anything — a stored-but-broken
        // connection is worse than no connection, since it would silently fail every future push.
        try
        {
            await wp.TestConnectionAsync(siteUrl, cmd.Username, cmd.AppPassword, ct);
        }
        catch (Exception ex)
        {
            return Result.Failure<WordPressStatusDto>(Error.Custom("Seo.WordPressConnectFailed", ex.Message));
        }

        var existing = await db.WordPressConnections.FirstOrDefaultAsync(c => c.SiteId == cmd.SiteId, ct);
        if (existing is not null) db.WordPressConnections.Remove(existing);

        var connection = new SeoWordPressConnection(cmd.SiteId, siteUrl, cmd.Username, protector.Protect(cmd.AppPassword)!);
        db.WordPressConnections.Add(connection);
        await db.SaveChangesAsync(ct);

        return Result.Success(connection.ToDto());
    }

    private static string NormalizeUrl(string url)
    {
        var u = url.Trim().TrimEnd('/');
        return u.StartsWith("http://", StringComparison.OrdinalIgnoreCase) || u.StartsWith("https://", StringComparison.OrdinalIgnoreCase)
            ? u : $"https://{u}";
    }
}

internal sealed class DisconnectWordPressHandler(SeoDbContext db) : ICommandHandler<DisconnectWordPressCommand>
{
    public async Task<Result> Handle(DisconnectWordPressCommand cmd, CancellationToken ct)
    {
        var connection = await db.WordPressConnections.FirstOrDefaultAsync(c => c.SiteId == cmd.SiteId, ct);
        if (connection is null) return Result.Success();

        connection.Delete();
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}

internal sealed class SetWordPressAutoPublishHandler(SeoDbContext db) : ICommandHandler<SetWordPressAutoPublishCommand, WordPressStatusDto>
{
    public async Task<Result<WordPressStatusDto>> Handle(SetWordPressAutoPublishCommand cmd, CancellationToken ct)
    {
        var connection = await db.WordPressConnections.FirstOrDefaultAsync(c => c.SiteId == cmd.SiteId, ct);
        if (connection is null) return Result.Failure<WordPressStatusDto>(Error.Custom("Seo.WordPress.Conflict", "This site has no WordPress connection."));

        connection.SetAutoPublish(cmd.AutoPublish);
        await db.SaveChangesAsync(ct);

        return Result.Success(connection.ToDto());
    }
}
