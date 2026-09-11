using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Softaxis.CRM.API.Controllers.Common;
using Softaxis.CRM.Application.Notifications.Commands;
using Softaxis.CRM.Application.Notifications.Queries;

namespace Softaxis.CRM.API.Controllers;

// The signed-in user's own notifications. No module permission: every handler is scoped to the caller's
// own rows, so there is nothing here a user could see that is not already theirs.
[ApiController][Route("api/crm/notifications")][Authorize]
public sealed class CrmNotificationsController(ISender sender) : CrmControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetMine([FromQuery] int take = 50, CancellationToken ct = default) =>
        OkOrError(await sender.Send(new GetMyNotificationsQuery(take), ct));

    [HttpPost("{id:guid}/read")]
    public async Task<IActionResult> MarkRead(Guid id, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new MarkNotificationReadCommand(id), ct));

    [HttpPost("read-all")]
    public async Task<IActionResult> MarkAllRead(CancellationToken ct) =>
        NoContentOrError(await sender.Send(new MarkAllNotificationsReadCommand(), ct));
}
