using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.CRM.Application.Documents.Dtos;

namespace Softaxis.CRM.Application.Documents.Commands;

/// <summary>Entity kinds a document can be attached to. Kept in one place so the API, validators and guards agree.</summary>
public static class CrmDocumentTargets
{
    public const string Lead     = "lead";
    public const string Deal     = "deal";
    public const string Customer = "customer";
    public const string Contact  = "contact";

    public static readonly string[] All = [Lead, Deal, Customer, Contact];

    public static bool IsValid(string? value) =>
        value is not null && All.Contains(value.Trim().ToLowerInvariant());
}

public sealed record UploadCrmDocumentCommand(
    string  RelatedToType,
    Guid    RelatedToId,
    byte[]  Data,
    string  FileName,
    string  ContentType,
    string  DocumentType,
    string? Description) : ICommand<CrmDocumentDto>;

public sealed class UploadCrmDocumentCommandValidator : AbstractValidator<UploadCrmDocumentCommand>
{
    /// <summary>
    /// 10 MB. Bytes live in the database (see <c>CrmDocument</c>), so this cap is what keeps the
    /// table from becoming unmanageable. The controller enforces the same limit at the request
    /// level so an oversized upload is rejected before it is buffered.
    /// </summary>
    public const long MaxBytes = 10 * 1024 * 1024;

    public UploadCrmDocumentCommandValidator()
    {
        RuleFor(x => x.RelatedToType)
            .Must(CrmDocumentTargets.IsValid)
            .WithMessage($"RelatedToType must be one of: {string.Join(", ", CrmDocumentTargets.All)}.");

        RuleFor(x => x.RelatedToId).NotEmpty();
        RuleFor(x => x.FileName)
            .NotEmpty().MaximumLength(300)
            .Must(f => !DocumentFileRules.IsBlocked(f))
            .WithMessage(x => DocumentFileRules.BlockedMessage(x.FileName));
        RuleFor(x => x.ContentType).NotEmpty().MaximumLength(150);
        RuleFor(x => x.DocumentType).NotEmpty().MaximumLength(40);
        RuleFor(x => x.Description).MaximumLength(1000);

        RuleFor(x => x.Data)
            .NotEmpty().WithMessage("The uploaded file is empty.")
            .Must(d => d.LongLength <= MaxBytes)
            .WithMessage($"File exceeds the {MaxBytes / (1024 * 1024)} MB limit.");
    }
}

public sealed record UpdateCrmDocumentCommand(
    Guid    Id,
    string  DocumentType,
    string? Description) : ICommand<CrmDocumentDto>;

public sealed class UpdateCrmDocumentCommandValidator : AbstractValidator<UpdateCrmDocumentCommand>
{
    public UpdateCrmDocumentCommandValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
        RuleFor(x => x.DocumentType).NotEmpty().MaximumLength(40);
        RuleFor(x => x.Description).MaximumLength(1000);
    }
}

public sealed record DeleteCrmDocumentCommand(Guid Id) : ICommand;
