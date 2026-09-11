namespace Softaxis.CRM.Application.Notifications.Dtos;

public sealed record CrmNotificationDto(
    Guid Id, string Type, string Title, string Message, string? Link,
    string? RelatedToType, Guid? RelatedToId, bool Read, DateTime CreatedAt);

public sealed record MyNotificationsDto(IReadOnlyList<CrmNotificationDto> Items, int UnreadCount);
