using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Insurance.Commands;
using Softaxis.CRM.Application.Insurance.Dtos;
using Softaxis.CRM.Domain.Entities;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Insurance;

internal sealed class RenewPolicyHandler(CrmDbContext db) : ICommandHandler<RenewPolicyCommand, PolicyRenewalDto>
{
    public async Task<Result<PolicyRenewalDto>> Handle(RenewPolicyCommand cmd, CancellationToken ct)
    {
        var p = await db.Policies.FindAsync([cmd.Id], ct);
        if (p is null)
            return Result.Failure<PolicyRenewalDto>(Error.NotFoundById("Policy", cmd.Id));

        var ren = new PolicyRenewal(p.Id, p.PolicyNumber, p.HolderName, cmd.RenewalDate, cmd.NewPremium ?? p.Premium, cmd.Notes);
        db.PolicyRenewals.Add(ren);
        await db.SaveChangesAsync(ct);

        return Result.Success(InsuranceMappings.ToDto(ren));
    }
}
