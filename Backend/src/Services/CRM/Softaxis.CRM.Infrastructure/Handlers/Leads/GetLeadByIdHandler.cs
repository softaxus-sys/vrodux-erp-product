using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Leads.Dtos;
using Softaxis.CRM.Application.Leads.Queries;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Leads;

internal sealed class GetLeadByIdHandler(CrmDbContext db) : IQueryHandler<GetLeadByIdQuery, LeadDto>
{
    public async Task<Result<LeadDto>> Handle(GetLeadByIdQuery query, CancellationToken ct)
    {
        var l = await db.Leads.AsNoTracking().FirstOrDefaultAsync(x => x.Id == query.Id, ct);
        if (l is null)
            return Result.Failure<LeadDto>(Error.NotFoundById("Lead", query.Id));

        return Result.Success(LeadMappings.ToDto(l));
    }
}
