using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Application.Notifications;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Seo.Application.Abstractions;
using Softaxis.Seo.Application.Fixes.Commands;
using Softaxis.Seo.Application.Fixes.Dtos;
using Softaxis.Seo.Infrastructure.Notifications;
using Softaxis.Seo.Infrastructure.Persistence;
using Softaxis.Seo.Infrastructure.Scanning;

namespace Softaxis.Seo.Infrastructure.Handlers.Fixes;

internal sealed class RunScanNowHandler(
    SeoDbContext db, ISiteScanRunner scanRunner, ICurrentUser currentUser, INotificationDispatcher notifications)
    : ICommandHandler<RunScanNowCommand, RunScanNowResultDto>
{
    public async Task<Result<RunScanNowResultDto>> Handle(RunScanNowCommand cmd, CancellationToken ct)
    {
        var site = await db.Sites.FirstOrDefaultAsync(s => s.Id == cmd.SiteId, ct);
        if (site is null) return Result.Failure<RunScanNowResultDto>(Error.NotFoundById("SeoSite", cmd.SiteId));

        var scan = await scanRunner.RunAsync(site, ct);

        if (scan.FixesProposed > 0 && currentUser.TenantId is { } tenantId)
        {
            try
            {
                var recipients = await SeoNotificationRecipients.GetAsync(db, tenantId, ct);
                await notifications.PublishManyAsync(recipients.Select(userId => new NotificationRequest(
                    RecipientUserId: userId,
                    Module:          NotificationModules.Seo,
                    Event:           NotificationEvents.SeoFixesReady,
                    Title:           $"{scan.FixesProposed} new SEO fix{(scan.FixesProposed == 1 ? "" : "es")} ready to review — {site.DisplayName}",
                    Message:         $"The scan found {scan.IssuesFound} issue(s) and the AI proposed {scan.FixesProposed} fix(es).",
                    Link:            $"/seo/sites/{site.Id}",
                    Type:            "info",
                    RelatedToType:   "seo_site",
                    RelatedToId:     site.Id)), ct);
            }
            catch { /* best-effort — a failed alert must never fail the scan the user just ran */ }
        }

        return Result.Success(new RunScanNowResultDto(scan.AuditId, scan.IssuesFound, scan.FixesProposed));
    }
}
