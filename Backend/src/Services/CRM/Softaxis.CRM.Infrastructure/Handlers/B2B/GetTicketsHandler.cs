using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.B2B.Dtos;
using Softaxis.CRM.Application.B2B.Queries;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.B2B;

internal sealed class GetTicketsHandler(CrmDbContext db) : IQueryHandler<GetTicketsQuery, IReadOnlyList<SupportTicketDto>>
{
    public async Task<Result<IReadOnlyList<SupportTicketDto>>> Handle(GetTicketsQuery query, CancellationToken ct)
    {
        var items = await db.SupportTickets.AsNoTracking().OrderByDescending(x => x.CreatedAt).ToListAsync(ct);
        return Result.Success<IReadOnlyList<SupportTicketDto>>(items.Select(B2BMappings.ToDto).ToList());
    }
}
