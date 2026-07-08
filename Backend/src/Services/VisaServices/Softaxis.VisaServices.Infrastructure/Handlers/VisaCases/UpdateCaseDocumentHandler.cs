using Microsoft.EntityFrameworkCore;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.VisaServices.Application.VisaCases.Commands;
using Softaxis.VisaServices.Domain.Entities;
using Softaxis.VisaServices.Infrastructure.Persistence;

namespace Softaxis.VisaServices.Infrastructure.Handlers.VisaCases;

internal sealed class UpdateCaseDocumentHandler(VisaDbContext db) : ICommandHandler<UpdateCaseDocumentCommand>
{
    private static readonly string[] AllowedStatuses = ["pending", "received", "verified", "rejected", "expired"];

    public async Task<Result> Handle(UpdateCaseDocumentCommand cmd, CancellationToken ct)
    {
        if (!AllowedStatuses.Contains(cmd.Status))
            return Result.Failure(Error.Custom("CaseDocument.InvalidStatus",
                $"Unknown document status '{cmd.Status}'."));

        var doc = await db.CaseDocuments
            .FirstOrDefaultAsync(d => d.Id == cmd.DocumentId && d.VisaCaseId == cmd.CaseId, ct);
        if (doc is null)
            return Result.Failure(Error.NotFoundById("CaseDocument", cmd.DocumentId));

        if (!string.IsNullOrWhiteSpace(cmd.FileUrl))
            doc.AttachFile(cmd.FileUrl, cmd.ExpiryDate);
        doc.SetStatus(cmd.Status, cmd.Notes);

        db.CaseStatusEvents.Add(new CaseStatusEvent(cmd.CaseId, "document", null, null,
            $"{doc.Name} → {cmd.Status}", cmd.ByName));

        // When the last outstanding document is verified, advance docs_pending → docs_complete.
        var vcase = await db.VisaCases.FindAsync([cmd.CaseId], ct);
        if (vcase is not null && vcase.Status == "docs_pending")
        {
            var anyOutstanding = await db.CaseDocuments
                .AnyAsync(d => d.VisaCaseId == cmd.CaseId && d.Id != doc.Id && d.Status != "verified", ct);
            if (!anyOutstanding && cmd.Status == "verified" && vcase.ChangeStatus("docs_complete"))
                db.CaseStatusEvents.Add(new CaseStatusEvent(cmd.CaseId, "status_change",
                    "docs_pending", "docs_complete", "All documents verified", cmd.ByName));
        }

        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
