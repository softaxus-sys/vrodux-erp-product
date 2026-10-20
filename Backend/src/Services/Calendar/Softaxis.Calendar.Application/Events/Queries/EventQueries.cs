using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.Calendar.Application.Events.Dtos;

namespace Softaxis.Calendar.Application.Events.Queries;

/// <summary>Events overlapping [FromUtc, ToUtc) that the caller owns or has been invited to.</summary>
public sealed record GetEventsQuery(DateTime FromUtc, DateTime ToUtc) : IQuery<IReadOnlyList<CalendarEventDto>>;

public sealed record GetEventByIdQuery(Guid Id) : IQuery<CalendarEventDto>;
