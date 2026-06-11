using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.B2B.Commands;
using Softaxis.CRM.Application.B2B.Dtos;
using Softaxis.CRM.Domain.Entities;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.B2B;

internal sealed class CreateProposalHandler(CrmDbContext db) : ICommandHandler<CreateProposalCommand, ProposalDto>
{
    public async Task<Result<ProposalDto>> Handle(CreateProposalCommand cmd, CancellationToken ct)
    {
        var p = new Proposal(cmd.LeadId, cmd.DealId, cmd.CustomerId, cmd.ClientName, cmd.Title, cmd.Amount, cmd.ValidUntil, cmd.Scope, cmd.Notes);
        db.Proposals.Add(p);
        await db.SaveChangesAsync(ct);

        return Result.Success(B2BMappings.ToDto(p));
    }
}
