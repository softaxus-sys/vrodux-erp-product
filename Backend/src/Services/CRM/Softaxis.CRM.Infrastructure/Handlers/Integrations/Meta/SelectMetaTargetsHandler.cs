using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Integrations.Commands;
using Softaxis.CRM.Application.LeadIntake.Abstractions;
using Softaxis.CRM.Domain.Entities.Integrations;
using Softaxis.CRM.Infrastructure.Integrations.Providers.Meta;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Integrations.Meta;

/// <summary>
/// Finalize Meta setup: enable the chosen pages, (re)create the selected form resources,
/// subscribe each page to leadgen webhooks, and mark the integration connected. Authenticated,
/// so new rows are tenant-stamped automatically.
/// </summary>
internal sealed class SelectMetaTargetsHandler(CrmDbContext db, MetaGraphClient graph, ISecretProtector protector)
    : ICommandHandler<SelectMetaTargetsCommand>
{
    public async Task<Result> Handle(SelectMetaTargetsCommand cmd, CancellationToken ct)
    {
        var integration = await db.Integrations.Include(x => x.Resources)
            .FirstOrDefaultAsync(x => x.Id == cmd.IntegrationId && !x.IsDeleted, ct);
        if (integration is null)
            return Result.Failure(Error.NotFoundById("Integration", cmd.IntegrationId));

        // Reset form selections; we recreate from the request.
        var oldForms = integration.Resources.Where(r => r.ResourceType == "form").ToList();
        db.IntegrationResources.RemoveRange(oldForms);

        var selectedPageIds = cmd.Pages.Select(p => p.PageId).ToHashSet();
        var subscribed = 0;

        foreach (var pageRes in integration.Resources.Where(r => r.ResourceType == "page"))
        {
            var enabled = selectedPageIds.Contains(pageRes.ExternalId);
            pageRes.SetEnabled(enabled);
            if (!enabled || pageRes.AccessToken is null) continue;

            var token = protector.Unprotect(pageRes.AccessToken)!;
            if (await graph.SubscribePageAsync(pageRes.ExternalId, token, ct)) subscribed++;

            var sel = cmd.Pages.First(p => p.PageId == pageRes.ExternalId);
            foreach (var form in sel.Forms)
            {
                var res = new IntegrationResource(integration.Id, "form", form.FormId, form.Name, pageRes.ExternalId);
                res.SetEnabled(true);
                integration.Resources.Add(res);
            }
        }

        if (subscribed == 0)
            return Result.Failure(Error.Custom("Integration.Conflict",
                "Could not subscribe any selected page to webhooks — check the page permissions."));

        integration.MarkConnected();
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
