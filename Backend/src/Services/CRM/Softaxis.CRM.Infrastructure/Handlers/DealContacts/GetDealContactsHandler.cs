using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.DealContacts.Dtos;
using Softaxis.CRM.Application.DealContacts.Queries;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.DealContacts;

internal sealed class GetDealContactsHandler(CrmDbContext db)
    : IQueryHandler<GetDealContactsQuery, IReadOnlyList<DealContactDto>>
{
    public async Task<Result<IReadOnlyList<DealContactDto>>> Handle(GetDealContactsQuery query, CancellationToken ct)
    {
        // Inner-join to contacts (whose query filter drops soft-deleted rows) so an
        // unlinked/deleted contact simply falls out of the list.
        var rows = await (
            from dc in db.DealContacts.AsNoTracking().Where(x => x.DealId == query.DealId)
            join c in db.Contacts.AsNoTracking() on dc.ContactId equals c.Id
            orderby c.IsPrimary descending, dc.CreatedAt
            select new { dc.Id, ContactId = c.Id, c.FirstName, c.LastName, c.Title, c.Email, c.Phone, c.Department, c.IsPrimary, dc.Role }
        ).ToListAsync(ct);

        var items = rows
            .Select(r => new DealContactDto(r.Id, r.ContactId, $"{r.FirstName} {r.LastName}".Trim(),
                r.Title, r.Email, r.Phone, r.Department, r.IsPrimary, r.Role))
            .ToList();

        return Result.Success<IReadOnlyList<DealContactDto>>(items);
    }
}
