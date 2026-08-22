using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Deals.Commands;
using Softaxis.CRM.Application.Deals.Dtos;
using Softaxis.CRM.Domain.Entities;
using Softaxis.CRM.Infrastructure.Persistence;
using Softaxis.CRM.Infrastructure.Services;

namespace Softaxis.CRM.Infrastructure.Handlers.Deals;

internal sealed class CreateDealHandler(CrmDbContext db, IDealStageRecorder stageRecorder) : ICommandHandler<CreateDealCommand, DealDto>
{
    public async Task<Result<DealDto>> Handle(CreateDealCommand cmd, CancellationToken ct)
    {
        // When linked to an account, use its canonical name as the denormalized display company.
        var company = cmd.Company;
        if (cmd.CustomerId is Guid cid)
        {
            var acct = await db.Customers.FindAsync([cid], ct);
            if (acct is not null) company = acct.Name;
        }

        var d = new Deal(cmd.Title, company, cmd.Value, cmd.Stage, cmd.Priority,
            cmd.Probability, cmd.ExpectedCloseDate, cmd.AssignedTo, cmd.Source, cmd.Industry, cmd.Description,
            cmd.ForecastCategory, cmd.CustomerId, cmd.AssignedToUserId);

        // The ctor takes no team, so stamp owner + team together. AssignTo clears the team when the
        // owner is null, so an unassigned deal cannot end up filed under one.
        if (cmd.AssignedToUserId is not null)
            d.AssignTo(cmd.AssignedToUserId, cmd.AssignedTo, cmd.TeamId);

        db.Deals.Add(d);
        stageRecorder.RecordCreated(d);   // opens the stage-history trail the velocity reports read
        await db.SaveChangesAsync(ct);

        return Result.Success(DealMappings.ToDto(d));
    }
}
