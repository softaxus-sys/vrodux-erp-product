using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Construction.Application.Bidding.Commands;
using Softaxis.Construction.Application.Bidding.Dtos;
using Softaxis.Construction.Domain.Entities;
using Softaxis.Construction.Infrastructure.Persistence;

namespace Softaxis.Construction.Infrastructure.Handlers.Bidding;

internal sealed class CreateEstimateHandler(ConstructionDbContext db)
    : ICommandHandler<CreateEstimateCommand, EstimateDto>
{
    public async Task<Result<EstimateDto>> Handle(CreateEstimateCommand cmd, CancellationToken ct)
    {
        var e = new Estimate(cmd.RfqId, cmd.DealId, cmd.CustomerId, cmd.ClientName, cmd.Title,
            cmd.Amount, cmd.ValidUntil, cmd.Notes);

        db.Estimates.Add(e);

        if (cmd.RfqId is { } rid)
        {
            var rfq = await db.Rfqs.FindAsync([rid], ct);
            rfq?.SetStatus("quoted");
        }

        await db.SaveChangesAsync(ct);

        return Result.Success(BiddingMappings.ToDto(e));
    }
}
