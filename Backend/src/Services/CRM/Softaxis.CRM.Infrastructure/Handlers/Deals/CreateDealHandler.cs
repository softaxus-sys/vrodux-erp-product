using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Abstractions;
using Softaxis.CRM.Application.Deals.Commands;
using Softaxis.CRM.Application.Deals.Dtos;
using Softaxis.CRM.Domain.Entities;
using Softaxis.CRM.Infrastructure.Persistence;
using Softaxis.CRM.Infrastructure.Services;

namespace Softaxis.CRM.Infrastructure.Handlers.Deals;

internal sealed class CreateDealHandler(CrmDbContext db, IDealStageRecorder stageRecorder, ICurrentUser currentUser, ILeadAccessGuard access) : ICommandHandler<CreateDealCommand, DealDto>
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

        // Default the owner to the CREATOR and the team to theirs when unambiguous — same reasoning
        // as CreateLeadHandler: an unowned record is invisible to everyone but full-access roles, so
        // a rep would lose the deal they just created. An explicit choice always wins.
        var ownerId = cmd.AssignedToUserId ?? currentUser.Id;
        var ownerName = cmd.AssignedToUserId is not null
            ? cmd.AssignedTo
            : (string.IsNullOrWhiteSpace(cmd.AssignedTo) ? currentUser.Username ?? "" : cmd.AssignedTo);

        if (ownerId is not null)
            d.AssignTo(ownerId, ownerName, cmd.TeamId ?? await access.SoleTeamOfCurrentUserAsync(ct));

        db.Deals.Add(d);
        stageRecorder.RecordCreated(d);   // opens the stage-history trail the velocity reports read
        await db.SaveChangesAsync(ct);

        return Result.Success(DealMappings.ToDto(d));
    }
}
