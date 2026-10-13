using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Softaxis.Calendar.API.Controllers.Common;
using Softaxis.Calendar.Application.Events.Commands;
using Softaxis.Calendar.Application.Events.Dtos;
using Softaxis.Calendar.Application.Events.Queries;
using Softaxis.Calendar.Application.Google;

namespace Softaxis.Calendar.API.Controllers;

/// <summary>
/// The calendar is a core feature, open to every signed-in user - there is deliberately no permission
/// key. What stops anyone reading someone else's schedule is not a role but the query: every read is
/// scoped to events the caller owns or has been invited to.
/// </summary>
[ApiController]
[Route("api/calendar")]
[Authorize]
public sealed class CalendarController(ISender sender, IConfiguration config) : CalendarControllerBase
{
    public sealed record EventRequest(
        string Title, string? Description, string? Location,
        DateTime StartUtc, DateTime EndUtc, bool IsAllDay, string? TimeZone,
        IReadOnlyList<AttendeeInput>? Attendees, bool AddMeet);

    [HttpGet("events")]
    public async Task<IActionResult> GetEvents([FromQuery] DateTime from, [FromQuery] DateTime to, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetEventsQuery(from, to), ct));

    [HttpGet("events/{id:guid}")]
    public async Task<IActionResult> GetEvent(Guid id, CancellationToken ct) =>
        OkOrError(await sender.Send(new GetEventByIdQuery(id), ct));

    [HttpPost("events")]
    public async Task<IActionResult> Create([FromBody] EventRequest r, CancellationToken ct) =>
        OkOrError(await sender.Send(new CreateEventCommand(
            r.Title, r.Description, r.Location, r.StartUtc, r.EndUtc, r.IsAllDay, r.TimeZone, r.Attendees, r.AddMeet), ct));

    [HttpPut("events/{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] EventRequest r, CancellationToken ct) =>
        OkOrError(await sender.Send(new UpdateEventCommand(
            id, r.Title, r.Description, r.Location, r.StartUtc, r.EndUtc, r.IsAllDay, r.TimeZone, r.Attendees, r.AddMeet), ct));

    [HttpDelete("events/{id:guid}")]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct) =>
        NoContentOrError(await sender.Send(new DeleteEventCommand(id), ct));

    // ── Google connection ───────────────────────────────────────────────────────────────────

    [HttpGet("google")]
    public async Task<IActionResult> Connection(CancellationToken ct) =>
        OkOrError(await sender.Send(new GetConnectionQuery(), ct));

    [HttpPost("google/connect")]
    public async Task<IActionResult> Connect(CancellationToken ct) =>
        OkOrError(await sender.Send(new StartGoogleConnectCommand(CallbackUri()), ct));

    [HttpGet("google/callback")]
    [AllowAnonymous]
    public async Task<IActionResult> Callback([FromQuery] string? code, [FromQuery] string? state,
        [FromQuery(Name = "error")] string? error, CancellationToken ct)
    {
        if (!string.IsNullOrEmpty(error) || string.IsNullOrEmpty(code) || string.IsNullOrEmpty(state))
            return Redirect(FrontendReturn("error"));

        var result = await sender.Send(new GoogleCallbackCommand(code, state, CallbackUri()), ct);
        return Redirect(FrontendReturn(result.IsSuccess ? "connected" : "error"));
    }

    [HttpPost("google/disconnect")]
    public async Task<IActionResult> Disconnect(CancellationToken ct) =>
        NoContentOrError(await sender.Send(new DisconnectGoogleCommand(), ct));

    [HttpPost("google/sync")]
    public async Task<IActionResult> Sync(CancellationToken ct) =>
        OkOrError(await sender.Send(new SyncNowCommand(), ct));

    private string CallbackUri() => $"{Request.Scheme}://{Request.Host}/api/calendar/google/callback";

    private string FrontendReturn(string status)
    {
        var baseUrl = config["Integrations:FrontendBaseUrl"]
            ?? config.GetSection("AllowedOrigins").Get<string[]>()?.FirstOrDefault()
            ?? "http://localhost:3000";
        return $"{baseUrl.TrimEnd('/')}/calendar?google={status}";
    }
}
