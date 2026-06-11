using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.B2B.Dtos;
using Softaxis.CRM.Application.B2B.Queries;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.B2B;

internal sealed class GetProposalsHandler(CrmDbContext db) : IQueryHandler<GetProposalsQuery, IReadOnlyList<ProposalDto>>
{
    public async Task<Result<IReadOnlyList<ProposalDto>>> Handle(GetProposalsQuery query, CancellationToken ct)
    {
        var items = await db.Proposals.AsNoTracking().OrderByDescending(x => x.CreatedAt).ToListAsync(ct);
        return Result.Success<IReadOnlyList<ProposalDto>>(items.Select(B2BMappings.ToDto).ToList());
    }
}
