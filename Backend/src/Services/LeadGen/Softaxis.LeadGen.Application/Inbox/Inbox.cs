using FluentValidation;
using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.LeadGen.Domain.Entities;

namespace Softaxis.LeadGen.Application.Inbox;

public sealed record ThreadDto(
    Guid Id, Guid MailboxId, string? MailboxAddress, Guid? ProspectId, string? ProspectName, Guid? CampaignId,
    string? CampaignName, string Counterparty, string Subject, string Classification, int MessageCount, int UnreadCount,
    bool HasReply, Guid? AssignedUserId, string? AssignedName, bool IsArchived, DateTime LastMessageAt, string? Snippet);

public sealed record MessageDto(
    Guid Id, string Direction, string Status, string From, string To, string? Cc, string Subject,
    string? BodyText, DateTime OccurredAt, bool IsRead, string? Error, int? StepNumber);

public sealed record ThreadDetailDto(ThreadDto Thread, IReadOnlyList<MessageDto> Messages);

public sealed record ThreadFilter(
    Guid? MailboxId = null, string? Classification = null, bool? Unread = null, bool? Mine = null,
    bool? Archived = false, bool? RepliesOnly = null, string? Search = null);

public sealed record GetThreadsQuery(ThreadFilter Filter, int Page = 1, int PageSize = 40) : IQuery<PagedResult<ThreadDto>>;
public sealed record GetThreadQuery(Guid Id) : IQuery<ThreadDetailDto>;
public sealed record InboxCountsDto(int Unread, int Replies, int NeedsAttention);
public sealed record GetInboxCountsQuery : IQuery<InboxCountsDto>;

public sealed record ReplyCommand(Guid ThreadId, string Body) : ICommand<MessageDto>;

public sealed record UpdateThreadCommand(Guid Id, string? Classification, Guid? AssignedUserId, string? AssignedName,
    bool ClearAssignee, bool? Archived, bool? MarkRead) : ICommand<ThreadDto>;

public sealed class ReplyValidator : AbstractValidator<ReplyCommand>
{
    public ReplyValidator() => RuleFor(x => x.Body).NotEmpty().WithMessage("Write a reply first.").MaximumLength(10000);
}

public sealed class UpdateThreadValidator : AbstractValidator<UpdateThreadCommand>
{
    public UpdateThreadValidator() =>
        RuleFor(x => x.Classification).Must(c => ThreadClass.All.Contains(c!)).When(x => x.Classification is not null)
            .WithMessage("Unknown label.");
}
