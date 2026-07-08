using Softaxis.VisaServices.Application.VisaCases.Dtos;
using Softaxis.VisaServices.Domain.Entities;

namespace Softaxis.VisaServices.Infrastructure.Handlers.VisaCases;

internal static class VisaCaseMappings
{
    public static ApplicantDto ToDto(Applicant a) => new(
        a.Id, a.FirstName, a.LastName, a.FullName, a.Nationality, a.PassportNumber,
        a.PassportExpiry, a.DateOfBirth, a.EmiratesId, a.UidNumber, a.Relationship);

    public static CaseDocumentDto ToDto(CaseDocument d) => new(
        d.Id, d.ApplicantId, d.Name, d.Status, d.FileUrl, d.ExpiryDate, d.Notes,
        d.CreatedAt, d.UpdatedAt);

    public static CaseStatusEventDto ToDto(CaseStatusEvent e) => new(
        e.Id, e.EventType, e.FromStatus, e.ToStatus, e.Note, e.ByName, e.CreatedAt);

    public static VisaTypeDto ToDto(VisaType t) => new(
        t.Id, t.Code, t.Name, t.Category, t.Channel, t.DefaultGovtFee, t.DefaultServiceFee,
        t.ProcessingDays, t.RequiredDocuments);

    public static VisaCaseDetailDto ToDetailDto(VisaCase c,
        IReadOnlyList<Applicant> applicants, IReadOnlyList<CaseDocument> documents,
        IReadOnlyList<CaseStatusEvent> timeline) => new(
        c.Id, c.CaseNumber, c.VisaTypeId, c.VisaTypeName, c.Channel, c.Emirate,
        c.CustomerId, c.CustomerName, c.Status, c.Priority, c.AssignedTo,
        c.ServiceFee, c.GovtFee, c.GovtReference, c.VisaExpiryDate, c.SlaDueDate, c.RejectionReason, c.Notes,
        c.InvoiceId, c.InvoiceNumber,
        applicants.Select(ToDto).ToList(), documents.Select(ToDto).ToList(),
        timeline.Select(ToDto).ToList(), c.CreatedAt, c.UpdatedAt);
}
