using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Insurance.Commands;
using Softaxis.CRM.Application.Insurance.Dtos;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Insurance;

internal sealed class ApproveClaimHandler(CrmDbContext db) : ICommandHandler<ApproveClaimCommand, InsuranceClaimDto>
{
    public async Task<Result<InsuranceClaimDto>> Handle(ApproveClaimCommand cmd, CancellationToken ct)
    {
        var c = await db.InsuranceClaims.FindAsync([cmd.Id], ct);
        if (c is null)
            return Result.Failure<InsuranceClaimDto>(Error.NotFoundById("InsuranceClaim", cmd.Id));

        c.Approve(cmd.Amount);
        await db.SaveChangesAsync(ct);

        return Result.Success(InsuranceMappings.ToDto(c));
    }
}
