using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Restaurant.Application.Notifications.Dtos;

namespace Softaxis.Restaurant.Application.Notifications.Queries;

/// <summary>GET /api/restaurant/notifications/{channel} — channel is "sms" or "whatsapp".</summary>
public sealed record GetNotificationProviderConfigQuery(string Channel) : IQuery<NotificationProviderConfigDto>;
