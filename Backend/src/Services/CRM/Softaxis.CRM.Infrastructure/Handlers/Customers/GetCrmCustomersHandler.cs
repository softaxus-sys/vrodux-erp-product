using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Customers.Dtos;
using Softaxis.CRM.Application.Customers.Queries;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Customers;

internal sealed class GetCrmCustomersHandler(CrmDbContext db) : IQueryHandler<GetCrmCustomersQuery, IReadOnlyList<CrmCustomerDto>>
{
    public async Task<Result<IReadOnlyList<CrmCustomerDto>>> Handle(GetCrmCustomersQuery query, CancellationToken ct)
    {
        var items = await db.Customers.AsNoTracking().Where(x => !x.IsDeleted)
            .OrderByDescending(x => x.TotalRevenue).ToListAsync(ct);

        return Result.Success<IReadOnlyList<CrmCustomerDto>>(items.Select(CrmCustomerMappings.ToDto).ToList());
    }
}
