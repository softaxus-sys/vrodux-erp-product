using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.CRM.Application.Abstractions;
using Softaxis.CRM.Application.Leads.Commands;
using Softaxis.CRM.Domain.Entities;
using Softaxis.CRM.Infrastructure.Persistence;
using Softaxis.CRM.Infrastructure.Services;

namespace Softaxis.CRM.Infrastructure.Handlers.Leads;

internal sealed class AssignLeadHandler(CrmDbContext db, ILeadAccessGuard access, ICurrentUser currentUser)
    : ICommandHandler<AssignLeadCommand>
{
    public async Task<Result> Handle(AssignLeadCommand cmd, CancellationToken ct)
    {
        var l = await db.Leads.FindAsync([cmd.Id], ct);
        // Reassigning requires edit rights on the lead — full-edit users can assign any lead;
        // assigned-edit users can only hand on a lead they currently own.
        if (l is null || !access.CanEdit(l))
            return Result.Failure(Error.NotFoundById("Lead", cmd.Id));

        var prevUserId = l.AssignedToUserId;
        var prevName   = l.AssignedTo;

        l.AssignTo(cmd.ToUserId, cmd.ToUserName);

        db.LeadAssignments.Add(new LeadAssignment(l.Id, prevUserId, prevName,
            cmd.ToUserId, cmd.ToUserName, currentUser.Id, currentUser.Username, cmd.Note));

        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
