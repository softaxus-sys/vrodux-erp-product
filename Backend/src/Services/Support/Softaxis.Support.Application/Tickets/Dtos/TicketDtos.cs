namespace Softaxis.Support.Application.Tickets.Dtos;

public sealed record TicketAttachmentDto(
    Guid Id, string FileName, string ContentType, string DataUri, long SizeBytes,
    string UploadedByName, DateTime CreatedAt);

public sealed record TicketMessageDto(
    Guid Id, Guid AuthorUserId, string AuthorName, bool IsFromAgent, string Body, DateTime CreatedAt,
    IReadOnlyList<TicketAttachmentDto> Attachments);

public sealed record TicketAssignmentDto(
    Guid Id, Guid? FromUserId, string? FromUserName, Guid? ToUserId, string? ToUserName,
    string ChangedByName, string? Note, DateTime CreatedAt);

/// <summary>List-row shape — used by both "my tickets" (customer) and the agent queue.</summary>
public sealed record TicketSummaryDto(
    Guid Id, string TicketNumber,
    Guid RequestingTenantId, string RequestingTenantName,
    Guid RequestingUserId, string RequestingUserName,
    string Subject, string Category, string Priority, string Status,
    Guid? AssignedToUserId, string? AssignedToUserName,
    int MessageCount, DateTime CreatedAt, DateTime? UpdatedAt, DateTime? ClosedAt);

/// <summary>Drawer/thread shape — the ticket plus its full message history and handoff log.</summary>
public sealed record TicketDetailDto(
    Guid Id, string TicketNumber,
    Guid RequestingTenantId, string RequestingTenantName,
    Guid RequestingUserId, string RequestingUserName, string RequestingUserEmail,
    string Subject, string Category, string Priority, string Status,
    Guid? AssignedToUserId, string? AssignedToUserName,
    IReadOnlyList<TicketMessageDto> Messages,
    IReadOnlyList<TicketAssignmentDto> AssignmentHistory,
    DateTime CreatedAt, DateTime? UpdatedAt, DateTime? ClosedAt);

/// <summary>Stat tiles for the agent queue page.</summary>
public sealed record SupportQueueSummaryDto(
    int Total, int Open, int InProgress, int WaitingOnCustomer, int Unassigned, int MyOpen);

/// <summary>A candidate assignee — a user of the operator tenant holding `support.tickets.edit`.</summary>
public sealed record SupportAgentDto(Guid Id, string Name, string Email);
