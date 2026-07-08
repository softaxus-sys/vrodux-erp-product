using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.VisaServices.Application.VisaCases.Commands;
using Softaxis.VisaServices.Domain.Entities;
using Softaxis.VisaServices.Infrastructure.Persistence;

namespace Softaxis.VisaServices.Infrastructure.Handlers.VisaCases;

internal sealed class AddCaseNoteHandler(VisaDbContext db) : ICommandHandler<AddCaseNoteCommand>
{
    public async Task<Result> Handle(AddCaseNoteCommand cmd, CancellationToken ct)
    {
        var vcase = await db.VisaCases.FindAsync([cmd.CaseId], ct);
        if (vcase is null)
            return Result.Failure(Error.NotFoundById("VisaCase", cmd.CaseId));

        db.CaseStatusEvents.Add(new CaseStatusEvent(cmd.CaseId, "note", null, null, cmd.Note, cmd.ByName));
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
