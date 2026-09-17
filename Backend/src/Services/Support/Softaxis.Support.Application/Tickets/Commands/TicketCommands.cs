using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Support.Application.Tickets.Dtos;

namespace Softaxis.Support.Application.Tickets.Commands;

public static class TicketCategories
{
    public static readonly string[] All =
        ["billing", "technical", "feature_request", "onboarding", "account_security", "general"];
}

public static class TicketPriorities
{
    public static readonly string[] All = ["low", "medium", "high", "urgent"];
}

/// <summary>
/// A file attached to a message — sent as a data URI (no dedicated blob store; see
/// TicketAttachment's own remarks). <see cref="TicketAttachmentLimits"/> is the single place both
/// the validators below and the handlers enforce size/count/type limits, so the two can never
/// drift apart.
/// </summary>
public sealed record AttachmentInput(string FileName, string ContentType, string DataUri);

public static class TicketAttachmentLimits
{
    public const int MaxAttachmentsPerMessage = 3;
    public const long MaxFileSizeBytes = 3 * 1024 * 1024; // 3 MB — screenshots/short logs, not general file storage

    public static readonly string[] AllowedContentTypes =
        ["image/png", "image/jpeg", "image/gif", "image/webp", "application/pdf", "text/plain", "text/csv"];

    /// <summary>Decodes the base64 payload (after the last comma, tolerating a missing/odd data-URI
    /// prefix) and returns its byte length. False on anything that isn't valid base64.</summary>
    public static bool TryGetSizeBytes(string dataUri, out long sizeBytes)
    {
        sizeBytes = 0;
        if (string.IsNullOrWhiteSpace(dataUri)) return false;
        var commaIndex = dataUri.IndexOf(',');
        var payload = commaIndex >= 0 ? dataUri[(commaIndex + 1)..] : dataUri;
        try
        {
            sizeBytes = ComputeBase64Length(payload);
            return true;
        }
        catch (FormatException)
        {
            return false;
        }
    }

    // Validates without allocating the full decoded buffer twice — Convert.FromBase64String would
    // do the same work, but callers here only ever need the length, not the bytes.
    private static long ComputeBase64Length(string base64)
    {
        var bytes = Convert.FromBase64String(base64);
        return bytes.LongLength;
    }

    public static IRuleBuilderOptions<T, IReadOnlyList<AttachmentInput>?> ValidateAttachments<T>(
        IRuleBuilder<T, IReadOnlyList<AttachmentInput>?> rule) =>
        rule.Must(list => list is null || list.Count <= MaxAttachmentsPerMessage)
            .WithMessage($"At most {MaxAttachmentsPerMessage} attachments per message.");
}

/// <summary>
/// Raises a new ticket. Deliberately takes NO tenant/user identity fields in the request —
/// those are always resolved server-side from the caller's own JWT (ICurrentUser), never from
/// the client, so nobody can raise a ticket "as" another tenant or user.
/// </summary>
public sealed record CreateTicketCommand(
    string Subject, string Category, string Priority, string Message,
    IReadOnlyList<AttachmentInput>? Attachments = null) : ICommand<TicketDetailDto>;

public sealed class CreateTicketValidator : AbstractValidator<CreateTicketCommand>
{
    public CreateTicketValidator()
    {
        RuleFor(x => x.Subject).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Message).NotEmpty().MaximumLength(5000);
        RuleFor(x => x.Category).Must(c => string.IsNullOrWhiteSpace(c) || TicketCategories.All.Contains(c))
            .WithMessage("Unknown ticket category.");
        RuleFor(x => x.Priority).Must(p => string.IsNullOrWhiteSpace(p) || TicketPriorities.All.Contains(p))
            .WithMessage("Unknown ticket priority.");
        TicketAttachmentLimits.ValidateAttachments(RuleFor(x => x.Attachments));
        RuleForEach(x => x.Attachments).SetValidator(new AttachmentInputValidator()).When(x => x.Attachments is not null);
    }
}

/// <summary>Adds a reply to a ticket's thread. Either party may call this — the handler decides
/// IsFromAgent from who the caller actually is, and enforces who may post at all.</summary>
public sealed record AddTicketMessageCommand(Guid TicketId, string Body,
    IReadOnlyList<AttachmentInput>? Attachments = null) : ICommand<TicketMessageDto>;

public sealed class AddTicketMessageValidator : AbstractValidator<AddTicketMessageCommand>
{
    public AddTicketMessageValidator()
    {
        RuleFor(x => x.TicketId).NotEmpty();
        RuleFor(x => x.Body).NotEmpty().MaximumLength(5000);
        TicketAttachmentLimits.ValidateAttachments(RuleFor(x => x.Attachments));
        RuleForEach(x => x.Attachments).SetValidator(new AttachmentInputValidator()).When(x => x.Attachments is not null);
    }
}

public sealed class AttachmentInputValidator : AbstractValidator<AttachmentInput>
{
    public AttachmentInputValidator()
    {
        RuleFor(x => x.FileName).NotEmpty().MaximumLength(255);
        RuleFor(x => x.ContentType).Must(c => TicketAttachmentLimits.AllowedContentTypes.Contains(c))
            .WithMessage($"Allowed file types: {string.Join(", ", TicketAttachmentLimits.AllowedContentTypes)}.");
        RuleFor(x => x.DataUri).NotEmpty()
            .Must(uri => TicketAttachmentLimits.TryGetSizeBytes(uri, out var size) && size <= TicketAttachmentLimits.MaxFileSizeBytes)
            .WithMessage($"Each file must be valid and no larger than {TicketAttachmentLimits.MaxFileSizeBytes / (1024 * 1024)} MB.");
    }
}

/// <summary>Agent-only: moves the ticket through its status machine.</summary>
public sealed record ChangeTicketStatusCommand(Guid TicketId, string Status) : ICommand;

public sealed class ChangeTicketStatusValidator : AbstractValidator<ChangeTicketStatusCommand>
{
    public ChangeTicketStatusValidator()
    {
        RuleFor(x => x.TicketId).NotEmpty();
        RuleFor(x => x.Status).NotEmpty().MaximumLength(30);
    }
}

/// <summary>Agent-only: assign/reassign/unassign (null AssignToUserId unassigns).</summary>
public sealed record AssignTicketCommand(Guid TicketId, Guid? AssignToUserId, string? AssignToUserName, string? Note) : ICommand;

public sealed class AssignTicketValidator : AbstractValidator<AssignTicketCommand>
{
    public AssignTicketValidator()
    {
        RuleFor(x => x.TicketId).NotEmpty();
        // AssignToUserName is required whenever AssignToUserId is set — a name-less assignee
        // would render as a blank row in the handoff history.
        RuleFor(x => x.AssignToUserName).NotEmpty()
            .When(x => x.AssignToUserId.HasValue)
            .WithMessage("An assignee name is required when assigning a ticket.");
    }
}

/// <summary>Agent-only: change ticket priority.</summary>
public sealed record SetTicketPriorityCommand(Guid TicketId, string Priority) : ICommand;

public sealed class SetTicketPriorityValidator : AbstractValidator<SetTicketPriorityCommand>
{
    public SetTicketPriorityValidator()
    {
        RuleFor(x => x.TicketId).NotEmpty();
        RuleFor(x => x.Priority).Must(p => TicketPriorities.All.Contains(p))
            .WithMessage("Unknown ticket priority.");
    }
}
