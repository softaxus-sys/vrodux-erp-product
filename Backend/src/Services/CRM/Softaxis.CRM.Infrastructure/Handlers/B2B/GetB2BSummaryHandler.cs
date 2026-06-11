using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.B2B.Dtos;
using Softaxis.CRM.Application.B2B.Queries;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.B2B;

internal sealed class GetB2BSummaryHandler(CrmDbContext db) : IQueryHandler<GetB2BSummaryQuery, B2BSummaryDto>
{
    public async Task<Result<B2BSummaryDto>> Handle(GetB2BSummaryQuery query, CancellationToken ct)
    {
        var prop = await db.Proposals.AsNoTracking().Select(x => new { x.Status, x.Amount }).ToListAsync(ct);
        var con  = await db.ServiceContracts.AsNoTracking().Select(x => new { x.Status, x.Value, x.ContractType }).ToListAsync(ct);
        var tkt  = await db.SupportTickets.AsNoTracking().Select(x => new { x.Status, x.Priority }).ToListAsync(ct);

        return Result.Success(new B2BSummaryDto(
            prop.Count(x => x.Status is "draft" or "sent"),
            prop.Where(x => x.Status is "draft" or "sent").Sum(x => x.Amount),
            con.Count(x => x.Status == "active"),
            con.Where(x => x.Status == "active" && x.ContractType is "amc" or "retainer" or "sla").Sum(x => x.Value),
            tkt.Count(x => x.Status is "open" or "in_progress"),
            tkt.Count(x => x.Status is "open" or "in_progress" && x.Priority == "critical"),
            tkt.Count(x => x.Status is "resolved" or "closed")));
    }
}
