using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.CRM.Application.Notifications.Dtos;

namespace Softaxis.CRM.Application.Notifications.Queries;

/// <summary>The signed-in user's newest notifications plus their unread total.</summary>
public sealed record GetMyNotificationsQuery(int Take = 50) : IQuery<MyNotificationsDto>;
