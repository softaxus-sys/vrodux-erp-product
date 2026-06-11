using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.B2B.Commands;
using Softaxis.CRM.Application.B2B.Dtos;
using Softaxis.CRM.Domain.Entities;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.B2B;

internal sealed class CreateContractHandler(CrmDbContext db) : ICommandHandler<CreateContractCommand, ServiceContractDto>
{
    public async Task<Result<ServiceContractDto>> Handle(CreateContractCommand cmd, CancellationToken ct)
    {
        var c = new ServiceContract(cmd.ProposalId, cmd.DealId, cmd.CustomerId, cmd.ClientName, cmd.Title,
            cmd.ContractType, cmd.Value, cmd.StartDate, cmd.EndDate, cmd.SlaTier, cmd.Notes);
        db.ServiceContracts.Add(c);

        if (cmd.ProposalId is { } pid)
        {
            var prop = await db.Proposals.FindAsync([pid], ct);
            prop?.SetStatus("accepted");
        }

        await db.SaveChangesAsync(ct);

        return Result.Success(B2BMappings.ToDto(c));
    }
}
