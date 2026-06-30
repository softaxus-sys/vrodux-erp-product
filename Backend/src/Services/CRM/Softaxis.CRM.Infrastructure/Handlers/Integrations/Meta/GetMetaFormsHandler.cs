using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Integrations.Queries;
using Softaxis.CRM.Application.LeadIntake.Abstractions;
using Softaxis.CRM.Infrastructure.Integrations.Providers.Meta;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Integrations.Meta;

internal sealed class GetMetaFormsHandler(CrmDbContext db, MetaGraphClient graph, ISecretProtector protector)
    : IQueryHandler<GetMetaFormsQuery, IReadOnlyList<MetaFormDto>>
{
    public async Task<Result<IReadOnlyList<MetaFormDto>>> Handle(GetMetaFormsQuery query, CancellationToken ct)
    {
        var integration = await db.Integrations.AsNoTracking().Include(x => x.Resources)
            .FirstOrDefaultAsync(x => x.Id == query.IntegrationId && !x.IsDeleted, ct);
        if (integration is null)
            return Result.Failure<IReadOnlyList<MetaFormDto>>(Error.NotFoundById("Integration", query.IntegrationId));

        var page = integration.Resources.FirstOrDefault(r => r.ResourceType == "page" && r.ExternalId == query.PageId);
        if (page?.AccessToken is null)
            return Result.Failure<IReadOnlyList<MetaFormDto>>(Error.Custom("Integration.Conflict", "Page not connected."));

        var token = protector.Unprotect(page.AccessToken)!;
        var enabledFormIds = integration.Resources
            .Where(r => r.ResourceType == "form" && r.Enabled).Select(r => r.ExternalId).ToHashSet();

        var forms = await graph.GetFormsAsync(query.PageId, token, ct);
        var dtos = forms.Select(f => new MetaFormDto(f.Id, f.Name, enabledFormIds.Contains(f.Id))).ToList();
        return Result.Success<IReadOnlyList<MetaFormDto>>(dtos);
    }
}
