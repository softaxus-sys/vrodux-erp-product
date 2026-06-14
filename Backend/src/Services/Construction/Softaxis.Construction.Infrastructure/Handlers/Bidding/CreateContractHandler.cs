using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Construction.Application.Bidding.Commands;
using Softaxis.Construction.Application.Bidding.Dtos;
using Softaxis.Construction.Domain.Entities;
using Softaxis.Construction.Infrastructure.Persistence;

namespace Softaxis.Construction.Infrastructure.Handlers.Bidding;

internal sealed class CreateContractHandler(ConstructionDbContext db)
    : ICommandHandler<CreateContractCommand, ConstructionContractDto>
{
    public async Task<Result<ConstructionContractDto>> Handle(CreateContractCommand cmd, CancellationToken ct)
    {
        var c = new ConstructionContract(cmd.DealId, cmd.CustomerId, cmd.EstimateId, cmd.ClientName, cmd.Title,
            cmd.ContractValue, cmd.StartDate, cmd.EndDate, cmd.Contractor, cmd.Notes);

        db.Contracts.Add(c);

        if (cmd.EstimateId is { } eid)
        {
            var est = await db.Estimates.FindAsync([eid], ct);
            est?.SetStatus("approved");
        }

        await db.SaveChangesAsync(ct);

        return Result.Success(BiddingMappings.ToDto(c));
    }
}
