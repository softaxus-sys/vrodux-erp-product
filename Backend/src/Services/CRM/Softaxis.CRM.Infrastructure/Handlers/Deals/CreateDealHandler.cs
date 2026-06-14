using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Deals.Commands;
using Softaxis.CRM.Application.Deals.Dtos;
using Softaxis.CRM.Domain.Entities;
using Softaxis.CRM.Infrastructure.Persistence;

namespace Softaxis.CRM.Infrastructure.Handlers.Deals;

internal sealed class CreateDealHandler(CrmDbContext db) : ICommandHandler<CreateDealCommand, DealDto>
{
    public async Task<Result<DealDto>> Handle(CreateDealCommand cmd, CancellationToken ct)
    {
        var d = new Deal(cmd.Title, cmd.Company, cmd.Value, cmd.Stage, cmd.Priority,
            cmd.Probability, cmd.ExpectedCloseDate, cmd.AssignedTo, cmd.Source, cmd.Industry, cmd.Description);

        db.Deals.Add(d);
        await db.SaveChangesAsync(ct);

        return Result.Success(DealMappings.ToDto(d));
    }
}
