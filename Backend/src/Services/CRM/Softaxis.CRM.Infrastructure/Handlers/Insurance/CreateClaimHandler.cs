using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Insurance.Commands;
using Softaxis.CRM.Application.Insurance.Dtos;
using Softaxis.CRM.Domain.Entities;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Insurance;

internal sealed class CreateClaimHandler(CrmDbContext db) : ICommandHandler<CreateClaimCommand, InsuranceClaimDto>
{
    public async Task<Result<InsuranceClaimDto>> Handle(CreateClaimCommand cmd, CancellationToken ct)
    {
        var pol = await db.Policies.FindAsync([cmd.PolicyId], ct);
        if (pol is null)
            return Result.Failure<InsuranceClaimDto>(Error.NotFoundById("Policy", cmd.PolicyId));

        var c = new InsuranceClaim(pol.Id, pol.PolicyNumber, pol.CustomerId, pol.HolderName, cmd.ClaimDate, cmd.ClaimAmount, cmd.Reason, cmd.Notes);
        db.InsuranceClaims.Add(c);
        await db.SaveChangesAsync(ct);

        return Result.Success(InsuranceMappings.ToDto(c));
    }
}
