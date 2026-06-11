using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Insurance.Commands;
using Softaxis.CRM.Application.Insurance.Dtos;
using Softaxis.CRM.Domain.Entities;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Insurance;

internal sealed class CreatePolicyHandler(CrmDbContext db) : ICommandHandler<CreatePolicyCommand, PolicyDto>
{
    public async Task<Result<PolicyDto>> Handle(CreatePolicyCommand cmd, CancellationToken ct)
    {
        var p = new Policy(cmd.LeadId, cmd.DealId, cmd.CustomerId, cmd.HolderName, cmd.ProductType,
            cmd.Premium, cmd.SumInsured, cmd.StartDate, cmd.EndDate, cmd.Agent, cmd.Notes);
        db.Policies.Add(p);
        await db.SaveChangesAsync(ct);

        return Result.Success(InsuranceMappings.ToDto(p));
    }
}
