using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Leads.Dtos;
using Softaxis.CRM.Application.Leads.Queries;
using Softaxis.CRM.Infrastructure.Persistence;
using Softaxis.CRM.Infrastructure.Services;

namespace Softaxis.CRM.Infrastructure.Handlers.Leads;

internal sealed class GetLeadAssignmentsHandler(CrmDbContext db, ILeadAccessGuard access)
    : IQueryHandler<GetLeadAssignmentsQuery, IReadOnlyList<LeadAssignmentDto>>
{
    public async Task<Result<IReadOnlyList<LeadAssignmentDto>>> Handle(GetLeadAssignmentsQuery query, CancellationToken ct)
    {
        // Only reveal the handoff trail for a lead the user is allowed to see.
        var lead = await db.Leads.AsNoTracking().FirstOrDefaultAsync(x => x.Id == query.LeadId, ct);
        if (lead is null || !await access.CanReadAsync(lead, ct))
            return Result.Failure<IReadOnlyList<LeadAssignmentDto>>(Error.NotFoundById("Lead", query.LeadId));

        var rows = await db.LeadAssignments.AsNoTracking()
            .Where(a => a.LeadId == query.LeadId)
            .OrderByDescending(a => a.CreatedAt)
            .ToListAsync(ct);

        return Result.Success<IReadOnlyList<LeadAssignmentDto>>(rows.Select(LeadMappings.ToDto).ToList());
    }
}
