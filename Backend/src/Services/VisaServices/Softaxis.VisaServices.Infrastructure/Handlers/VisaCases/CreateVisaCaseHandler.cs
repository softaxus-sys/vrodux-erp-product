using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.BuildingBlocks.Domain.Results;
using Softaxis.VisaServices.Application.VisaCases.Commands;
using Softaxis.VisaServices.Application.VisaCases.Dtos;
using Softaxis.VisaServices.Domain.Entities;
using Softaxis.VisaServices.Infrastructure.Persistence;

namespace Softaxis.VisaServices.Infrastructure.Handlers.VisaCases;

internal sealed class CreateVisaCaseHandler(VisaDbContext db)
    : ICommandHandler<CreateVisaCaseCommand, VisaCaseDetailDto>
{
    public async Task<Result<VisaCaseDetailDto>> Handle(CreateVisaCaseCommand cmd, CancellationToken ct)
    {
        var visaType = await db.VisaTypes.FindAsync([cmd.VisaTypeId], ct);
        if (visaType is null)
            return Result.Failure<VisaCaseDetailDto>(Error.NotFoundById("VisaType", cmd.VisaTypeId));

        // Fees default from the visa type; SLA defaults from its processing days.
        var slaDue = cmd.SlaDueDate
            ?? DateTime.UtcNow.AddDays(visaType.ProcessingDays).ToString("yyyy-MM-dd");
        var vcase = new VisaCase(visaType.Id, visaType.Name, visaType.Channel, cmd.Emirate,
            cmd.CustomerName, cmd.CustomerId, cmd.Priority, cmd.AssignedTo,
            cmd.ServiceFee ?? visaType.DefaultServiceFee, cmd.GovtFee ?? visaType.DefaultGovtFee,
            slaDue, cmd.Notes);
        db.VisaCases.Add(vcase);

        var applicants = new List<Applicant>();
        foreach (var a in cmd.Applicants)
        {
            var applicant = new Applicant(vcase.Id, a.FirstName, a.LastName, a.Nationality,
                a.PassportNumber, a.PassportExpiry, a.DateOfBirth, a.EmiratesId, a.UidNumber,
                a.Relationship);
            db.Applicants.Add(applicant);
            applicants.Add(applicant);
        }

        // Instantiate the visa type's document checklist per applicant.
        var documents = new List<CaseDocument>();
        foreach (var applicant in applicants)
            foreach (var docName in visaType.RequiredDocuments)
            {
                var doc = new CaseDocument(vcase.Id, applicant.Id, docName);
                db.CaseDocuments.Add(doc);
                documents.Add(doc);
            }

        var timeline = new List<CaseStatusEvent>
        {
            new(vcase.Id, "created", null, "draft", $"Case created — {visaType.Name}", cmd.CreatedByName),
        };

        // New cases with a checklist go straight into document collection.
        if (documents.Count > 0 && vcase.ChangeStatus("docs_pending"))
            timeline.Add(new CaseStatusEvent(vcase.Id, "status_change", "draft",
                "docs_pending", "Document collection started", cmd.CreatedByName));

        db.CaseStatusEvents.AddRange(timeline);
        await db.SaveChangesAsync(ct);

        return Result.Success(VisaCaseMappings.ToDetailDto(vcase, applicants, documents, timeline));
    }
}
