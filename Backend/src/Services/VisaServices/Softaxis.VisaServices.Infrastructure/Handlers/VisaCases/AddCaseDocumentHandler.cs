using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.VisaServices.Application.VisaCases.Commands;
using Softaxis.VisaServices.Application.VisaCases.Dtos;
using Softaxis.VisaServices.Domain.Entities;
using Softaxis.VisaServices.Infrastructure.Persistence;

namespace Softaxis.VisaServices.Infrastructure.Handlers.VisaCases;

internal sealed class AddCaseDocumentHandler(VisaDbContext db)
    : ICommandHandler<AddCaseDocumentCommand, CaseDocumentDto>
{
    public async Task<Result<CaseDocumentDto>> Handle(AddCaseDocumentCommand cmd, CancellationToken ct)
    {
        var vcase = await db.VisaCases.FindAsync([cmd.CaseId], ct);
        if (vcase is null)
            return Result.Failure<CaseDocumentDto>(Error.NotFoundById("VisaCase", cmd.CaseId));

        var doc = new CaseDocument(cmd.CaseId, cmd.ApplicantId, cmd.Name);
        db.CaseDocuments.Add(doc);
        db.CaseStatusEvents.Add(new CaseStatusEvent(cmd.CaseId, "document", null, null,
            $"Requirement added: {doc.Name}", cmd.ByName));

        await db.SaveChangesAsync(ct);
        return Result.Success(VisaCaseMappings.ToDto(doc));
    }
}
