using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.HR.Application.EmployeeDocuments.Dtos;

namespace Softaxis.HR.Application.EmployeeDocuments.Commands;

public sealed record UploadEmployeeDocumentCommand(
    Guid    EmployeeId,
    string  FileName,
    string  ContentType,
    byte[]  Data,
    string  DocumentType,
    string? Description,
    string? ExpiryDate,
    Guid?   UploadedByUserId,
    string? UploadedByName) : ICommand<EmployeeDocumentDto>;

public sealed record UpdateEmployeeDocumentCommand(
    Guid    EmployeeId,
    Guid    DocumentId,
    string  DocumentType,
    string? Description,
    string? ExpiryDate) : ICommand;

public sealed record DeleteEmployeeDocumentCommand(Guid EmployeeId, Guid DocumentId) : ICommand;

public sealed class UploadEmployeeDocumentValidator : AbstractValidator<UploadEmployeeDocumentCommand>
{
    // 10 MB: passport scans and signed PDFs sit well under this, and the bytes travel in the
    // request body and live in the database, so an unbounded upload would hurt both.
    public const int MaxBytes = 10 * 1024 * 1024;

    public UploadEmployeeDocumentValidator()
    {
        RuleFor(x => x.FileName).NotEmpty().MaximumLength(260)
            .WithMessage("A file name is required.");
        RuleFor(x => x.Data).Must(d => d is { Length: > 0 })
            .WithMessage("The file is empty.");
        RuleFor(x => x.Data).Must(d => d.Length <= MaxBytes)
            .WithMessage("File must be 10 MB or smaller.");
    }
}
