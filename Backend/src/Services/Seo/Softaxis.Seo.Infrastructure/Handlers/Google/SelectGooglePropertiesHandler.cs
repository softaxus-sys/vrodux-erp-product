using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Seo.Application.Google.Commands;
using Softaxis.Seo.Domain.Entities;
using Softaxis.Seo.Infrastructure.Persistence;

namespace Softaxis.Seo.Infrastructure.Handlers.Google;

internal sealed class SelectGooglePropertiesHandler(SeoDbContext db) : ICommandHandler<SelectGooglePropertiesCommand>
{
    public async Task<Result> Handle(SelectGooglePropertiesCommand cmd, CancellationToken ct)
    {
        var integration = await db.GoogleIntegrations.FirstOrDefaultAsync(g => g.SiteId == cmd.SiteId, ct);
        if (integration is null)
            return Result.Failure(Error.Custom("Seo.NotConnected", "Google is not connected for this site yet."));

        var existing = await db.GoogleResources.Where(r => r.IntegrationId == integration.Id).ToListAsync(ct);
        db.GoogleResources.RemoveRange(existing);

        if (!string.IsNullOrWhiteSpace(cmd.GscPropertyId))
            db.GoogleResources.Add(new SeoGoogleResource(
                integration.Id, SeoGoogleResourceTypes.GscProperty, cmd.GscPropertyId, cmd.GscPropertyName ?? cmd.GscPropertyId));

        if (!string.IsNullOrWhiteSpace(cmd.Ga4PropertyId))
            db.GoogleResources.Add(new SeoGoogleResource(
                integration.Id, SeoGoogleResourceTypes.Ga4Property, cmd.Ga4PropertyId, cmd.Ga4PropertyName ?? cmd.Ga4PropertyId));

        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
