using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.Construction.Application.Bidding.Commands;
using Softaxis.Construction.Application.Bidding.Dtos;
using Softaxis.Construction.Domain.Entities;
using Softaxis.Construction.Infrastructure.Persistence;

namespace Softaxis.Construction.Infrastructure.Handlers.Bidding;

internal sealed class CreateRfqHandler(ConstructionDbContext db)
    : ICommandHandler<CreateRfqCommand, RfqDto>
{
    public async Task<Result<RfqDto>> Handle(CreateRfqCommand cmd, CancellationToken ct)
    {
        var e = new Rfq(cmd.LeadId, cmd.CustomerId, cmd.ClientName, cmd.ProjectTitle, cmd.Scope,
            cmd.Budget, cmd.DueDate, cmd.AssignedTo ?? "", cmd.Notes);

        db.Rfqs.Add(e);
        await db.SaveChangesAsync(ct);

        return Result.Success(BiddingMappings.ToDto(e));
    }
}
