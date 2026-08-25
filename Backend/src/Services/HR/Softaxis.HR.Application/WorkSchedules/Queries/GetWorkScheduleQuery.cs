using Softaxis.BuildingBlocks.Application.CQRS;
using Softaxis.HR.Application.WorkSchedules.Dtos;

namespace Softaxis.HR.Application.WorkSchedules.Queries;

/// <summary>
/// The tenant's office hours. Always returns a schedule — the first read seeds a sensible default
/// rather than handing back null, so nothing downstream has to special-case "not configured yet".
/// </summary>
public sealed record GetWorkScheduleQuery : IQuery<WorkScheduleDto>;
