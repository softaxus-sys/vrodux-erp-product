using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Leads.Dtos;
using Softaxis.CRM.Application.Leads.Queries;
using Softaxis.CRM.Infrastructure.Persistence;
using Softaxis.CRM.Infrastructure.Services;

namespace Softaxis.CRM.Infrastructure.Handlers.Leads;

internal sealed class GetLeadByIdHandler(CrmDbContext db, ILeadAccessGuard access) : IQueryHandler<GetLeadByIdQuery, LeadDto>
{
    public async Task<Result<LeadDto>> Handle(GetLeadByIdQuery query, CancellationToken ct)
    {
        var l = await db.Leads.AsNoTracking().FirstOrDefaultAsync(x => x.Id == query.Id, ct);
        // Treat a lead the user can't see as non-existent (don't leak that it exists).
        if (l is null || !await access.CanReadAsync(l, ct))
            return Result.Failure<LeadDto>(Error.NotFoundById("Lead", query.Id));

        var outcomes = await ConvertedDealOutcomes.LoadAsync(db, [l], ct);
        var (stage, value) = ConvertedDealOutcomes.For(outcomes, l);

        return Result.Success(LeadMappings.ToDto(l, stage, value));
    }
}
