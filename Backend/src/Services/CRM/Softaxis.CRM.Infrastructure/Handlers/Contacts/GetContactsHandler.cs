using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Contacts.Dtos;
using Softaxis.CRM.Application.Contacts.Queries;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Contacts;

internal sealed class GetContactsHandler(CrmDbContext db) : IQueryHandler<GetContactsQuery, IReadOnlyList<ContactDto>>
{
    public async Task<Result<IReadOnlyList<ContactDto>>> Handle(GetContactsQuery query, CancellationToken ct)
    {
        var q = db.Contacts.AsNoTracking().AsQueryable();
        if (query.CustomerId.HasValue) q = q.Where(c => c.CustomerId == query.CustomerId.Value);

        var items = await q.OrderByDescending(c => c.IsPrimary).ThenBy(c => c.FirstName).ToListAsync(ct);

        return Result.Success<IReadOnlyList<ContactDto>>(items.Select(ContactMappings.ToDto).ToList());
    }
}
