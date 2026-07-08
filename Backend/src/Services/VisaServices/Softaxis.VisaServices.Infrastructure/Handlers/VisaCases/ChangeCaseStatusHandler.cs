using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.VisaServices.Application.VisaCases.Commands;
using Softaxis.VisaServices.Domain.Entities;
using Softaxis.VisaServices.Infrastructure.Persistence;

namespace Softaxis.VisaServices.Infrastructure.Handlers.VisaCases;

internal sealed class ChangeCaseStatusHandler(VisaDbContext db) : ICommandHandler<ChangeCaseStatusCommand>
{
    public async Task<Result> Handle(ChangeCaseStatusCommand cmd, CancellationToken ct)
    {
        var vcase = await db.VisaCases.FindAsync([cmd.Id], ct);
        if (vcase is null)
            return Result.Failure(Error.NotFoundById("VisaCase", cmd.Id));

        var from = vcase.Status;
        if (!vcase.ChangeStatus(cmd.Status, cmd.RejectionReason))
            return Result.Failure(Error.Custom("VisaCase.InvalidTransition",
                $"A {from} case cannot move to {cmd.Status}."));

        if (!string.IsNullOrWhiteSpace(cmd.GovtReference))
            vcase.SetGovtReference(cmd.GovtReference);
        if (!string.IsNullOrWhiteSpace(cmd.VisaExpiryDate))
            vcase.SetVisaExpiry(cmd.VisaExpiryDate);

        db.CaseStatusEvents.Add(new CaseStatusEvent(vcase.Id, "status_change", from,
            cmd.Status, cmd.Note ?? cmd.RejectionReason, cmd.ByName));

        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
