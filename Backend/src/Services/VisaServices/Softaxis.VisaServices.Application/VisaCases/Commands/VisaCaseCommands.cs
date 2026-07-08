using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.VisaServices.Application.VisaCases.Dtos;

namespace Softaxis.VisaServices.Application.VisaCases.Commands;

/// <summary>Applicant payload embedded in case creation.</summary>
public sealed record ApplicantInput(
    string FirstName, string LastName, string Nationality, string PassportNumber,
    string? PassportExpiry, string? DateOfBirth, string? EmiratesId, string? UidNumber,
    string Relationship);

public sealed record CreateVisaCaseCommand(
    Guid VisaTypeId, string Emirate, string? CustomerName, Guid? CustomerId,
    string Priority, string AssignedTo, decimal? ServiceFee, decimal? GovtFee,
    string? SlaDueDate, string? Notes, IReadOnlyList<ApplicantInput> Applicants,
    string CreatedByName) : ICommand<VisaCaseDetailDto>;

public sealed class CreateVisaCaseValidator : AbstractValidator<CreateVisaCaseCommand>
{
    public CreateVisaCaseValidator()
    {
        RuleFor(x => x.VisaTypeId).NotEmpty();
        RuleFor(x => x.Applicants).NotEmpty().WithMessage("At least one applicant is required.");
        RuleForEach(x => x.Applicants).ChildRules(a =>
        {
            a.RuleFor(x => x.FirstName).NotEmpty();
            a.RuleFor(x => x.PassportNumber).NotEmpty();
            a.RuleFor(x => x.Nationality).NotEmpty();
        });
    }
}

/// <summary>
/// Moves the case through the status machine. Optional GovtReference is stored when the
/// PRO submits manually; RejectionReason only applies to the "rejected" transition.
/// </summary>
public sealed record ChangeCaseStatusCommand(
    Guid Id, string Status, string? GovtReference, string? RejectionReason,
    string? VisaExpiryDate, string? Note, string ByName) : ICommand;

public sealed class ChangeCaseStatusValidator : AbstractValidator<ChangeCaseStatusCommand>
{
    public ChangeCaseStatusValidator()
    {
        RuleFor(x => x.Status).NotEmpty().MaximumLength(20);
    }
}

public sealed record AssignCaseCommand(Guid Id, string AssignedTo, string ByName) : ICommand;

public sealed class AssignCaseValidator : AbstractValidator<AssignCaseCommand>
{
    public AssignCaseValidator() { RuleFor(x => x.AssignedTo).NotEmpty().MaximumLength(200); }
}

/// <summary>Update one checklist row: status, file attachment, expiry, notes.</summary>
public sealed record UpdateCaseDocumentCommand(
    Guid CaseId, Guid DocumentId, string Status, string? FileUrl, string? ExpiryDate,
    string? Notes, string ByName) : ICommand;

public sealed class UpdateCaseDocumentValidator : AbstractValidator<UpdateCaseDocumentCommand>
{
    public UpdateCaseDocumentValidator() { RuleFor(x => x.Status).NotEmpty().MaximumLength(20); }
}

/// <summary>Add an ad-hoc document requirement to a case's checklist.</summary>
public sealed record AddCaseDocumentCommand(
    Guid CaseId, Guid? ApplicantId, string Name, string ByName) : ICommand<CaseDocumentDto>;

public sealed class AddCaseDocumentValidator : AbstractValidator<AddCaseDocumentCommand>
{
    public AddCaseDocumentValidator() { RuleFor(x => x.Name).NotEmpty().MaximumLength(200); }
}

public sealed record AddCaseNoteCommand(Guid CaseId, string Note, string ByName) : ICommand;

public sealed class AddCaseNoteValidator : AbstractValidator<AddCaseNoteCommand>
{
    public AddCaseNoteValidator() { RuleFor(x => x.Note).NotEmpty().MaximumLength(2000); }
}

/// <summary>Records the Finance invoice that was raised (by the frontend) for this case.</summary>
public sealed record LinkCaseInvoiceCommand(Guid Id, Guid InvoiceId, string? InvoiceNumber, string ByName) : ICommand;

public sealed class LinkCaseInvoiceValidator : AbstractValidator<LinkCaseInvoiceCommand>
{
    public LinkCaseInvoiceValidator() { RuleFor(x => x.InvoiceId).NotEmpty(); }
}

public sealed record DeleteVisaCaseCommand(Guid Id) : ICommand;
