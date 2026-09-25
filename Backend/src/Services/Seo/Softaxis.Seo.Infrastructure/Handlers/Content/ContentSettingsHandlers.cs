using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Seo.Application.Content.Commands;
using Softaxis.Seo.Application.Content.Dtos;
using Softaxis.Seo.Application.Content.Queries;
using Softaxis.Seo.Domain.Entities;
using Softaxis.Seo.Infrastructure.Persistence;

namespace Softaxis.Seo.Infrastructure.Handlers.Content;

/// <summary>Lazily creates the settings row on first read — mirrors RentAlertSettings/VisaType's own
/// "seeded on first read, never at startup" pattern (a startup seed has no ambient tenant).</summary>
internal sealed class GetContentSettingsHandler(SeoDbContext db) : IQueryHandler<GetContentSettingsQuery, ContentSettingsDto>
{
    public async Task<Result<ContentSettingsDto>> Handle(GetContentSettingsQuery query, CancellationToken ct)
    {
        var site = await db.Sites.FirstOrDefaultAsync(s => s.Id == query.SiteId, ct);
        if (site is null) return Result.Failure<ContentSettingsDto>(Error.NotFoundById("SeoSite", query.SiteId));

        var settings = await db.ContentSettings.FirstOrDefaultAsync(cs => cs.SiteId == query.SiteId, ct);
        if (settings is null)
        {
            settings = new SeoContentSettings(query.SiteId);
            db.ContentSettings.Add(settings);
            await db.SaveChangesAsync(ct);
        }

        return Result.Success(settings.ToDto());
    }
}

internal sealed class UpdateContentSettingsHandler(SeoDbContext db) : ICommandHandler<UpdateContentSettingsCommand, ContentSettingsDto>
{
    public async Task<Result<ContentSettingsDto>> Handle(UpdateContentSettingsCommand cmd, CancellationToken ct)
    {
        var settings = await db.ContentSettings.FirstOrDefaultAsync(cs => cs.SiteId == cmd.SiteId, ct);
        if (settings is null)
        {
            var site = await db.Sites.FirstOrDefaultAsync(s => s.Id == cmd.SiteId, ct);
            if (site is null) return Result.Failure<ContentSettingsDto>(Error.NotFoundById("SeoSite", cmd.SiteId));
            settings = new SeoContentSettings(cmd.SiteId);
            db.ContentSettings.Add(settings);
        }

        settings.Update(cmd.Enabled, cmd.Frequency, cmd.ArticlesPerRun, cmd.TargetWordCount, cmd.NicheHint, cmd.CompetitorDomainsCsv);
        await db.SaveChangesAsync(ct);

        return Result.Success(settings.ToDto());
    }
}
