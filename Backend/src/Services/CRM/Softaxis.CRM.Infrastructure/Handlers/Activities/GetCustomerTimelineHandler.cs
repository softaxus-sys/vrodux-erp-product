using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Activities.Dtos;
using Softaxis.CRM.Application.Activities.Queries;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Activities;

internal sealed class GetCustomerTimelineHandler(CrmDbContext db)
    : IQueryHandler<GetCustomerTimelineQuery, IReadOnlyList<ActivityDto>>
{
    public async Task<Result<IReadOnlyList<ActivityDto>>> Handle(GetCustomerTimelineQuery query, CancellationToken ct)
    {
        // Sub-queries carry their own tenant + soft-delete filters, so the union is
        // automatically scoped to this tenant's non-deleted deals/leads.
        var dealIds = db.Deals.Where(d => d.CustomerId == query.CustomerId).Select(d => d.Id);
        var leadIds = db.Leads.Where(l => l.ConvertedCustomerId == query.CustomerId).Select(l => l.Id);

        var items = await db.Activities.AsNoTracking()
            .Where(a =>
                (a.RelatedToType == "customer" && a.RelatedToId == query.CustomerId) ||
                (a.RelatedToType == "deal"     && dealIds.Contains(a.RelatedToId)) ||
                (a.RelatedToType == "lead"     && leadIds.Contains(a.RelatedToId)))
            .OrderBy(a => a.Completed)
            .ThenBy(a => a.DueDate == null)
            .ThenBy(a => a.DueDate)
            .ThenByDescending(a => a.CreatedAt)
            .ToListAsync(ct);

        return Result.Success<IReadOnlyList<ActivityDto>>(items.Select(ActivityMappings.ToDto).ToList());
    }
}
