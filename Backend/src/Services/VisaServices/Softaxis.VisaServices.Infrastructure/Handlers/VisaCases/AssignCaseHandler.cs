using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.VisaServices.Application.VisaCases.Commands;
using Softaxis.VisaServices.Domain.Entities;
using Softaxis.VisaServices.Infrastructure.Persistence;

namespace Softaxis.VisaServices.Infrastructure.Handlers.VisaCases;

internal sealed class AssignCaseHandler(VisaDbContext db) : ICommandHandler<AssignCaseCommand>
{
    public async Task<Result> Handle(AssignCaseCommand cmd, CancellationToken ct)
    {
        var vcase = await db.VisaCases.FindAsync([cmd.Id], ct);
        if (vcase is null)
            return Result.Failure(Error.NotFoundById("VisaCase", cmd.Id));

        vcase.Assign(cmd.AssignedTo);
        db.CaseStatusEvents.Add(new CaseStatusEvent(vcase.Id, "assignment", null, null,
            $"Assigned to {cmd.AssignedTo}", cmd.ByName));

        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
