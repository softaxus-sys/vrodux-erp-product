using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Customers.Commands;
using Softaxis.CRM.Application.Customers.Dtos;
using Softaxis.CRM.Domain.Entities;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Customers;

internal sealed class CreateCrmCustomerHandler(CrmDbContext db) : ICommandHandler<CreateCrmCustomerCommand, CrmCustomerDto>
{
    public async Task<Result<CrmCustomerDto>> Handle(CreateCrmCustomerCommand cmd, CancellationToken ct)
    {
        var c = new CrmCustomer(cmd.Name, cmd.Industry, cmd.Country, cmd.City, cmd.Address,
            cmd.Phone, cmd.Email, cmd.Tier, cmd.AccountManager, cmd.Description);

        db.Customers.Add(c);
        await db.SaveChangesAsync(ct);

        return Result.Success(CrmCustomerMappings.ToDto(c));
    }
}
