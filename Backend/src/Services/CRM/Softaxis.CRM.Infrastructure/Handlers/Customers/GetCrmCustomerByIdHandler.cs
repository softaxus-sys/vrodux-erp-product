using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Customers.Dtos;
using Softaxis.CRM.Application.Customers.Queries;
using Softaxis.CRM.Infrastructure.Persistence;
using Softaxis.CRM.Infrastructure.Services;

namespace Softaxis.CRM.Infrastructure.Handlers.Customers;

internal sealed class GetCrmCustomerByIdHandler(CrmDbContext db, ILeadAccessGuard access) : IQueryHandler<GetCrmCustomerByIdQuery, CrmCustomerDto>
{
    public async Task<Result<CrmCustomerDto>> Handle(GetCrmCustomerByIdQuery query, CancellationToken ct)
    {
        var c = await db.Customers.AsNoTracking().FirstOrDefaultAsync(x => x.Id == query.Id, ct);
        if (c is null)
            return Result.Failure<CrmCustomerDto>(Error.NotFoundById("CrmCustomer", query.Id));

        // NotFound rather than Forbidden — never leak that a record the caller may not see exists.
        if (!await access.CanReadCustomerAsync(c, ct))
            return Result.Failure<CrmCustomerDto>(Error.NotFoundById("CrmCustomer", query.Id));

        return Result.Success(CrmCustomerMappings.ToDto(c));
    }
}
