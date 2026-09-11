using Softaxis.BuildingBlocks.Application.CQRS;

namespace Softaxis.CRM.Application.Notifications.Commands;

/// <summary>Marks one of the signed-in user's own notifications as read.</summary>
public sealed record MarkNotificationReadCommand(Guid Id) : ICommand;

/// <summary>Marks every unread notification of the signed-in user as read.</summary>
public sealed record MarkAllNotificationsReadCommand : ICommand;
